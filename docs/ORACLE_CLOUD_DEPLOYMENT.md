# Déploiement EDebou sur Oracle Cloud Infrastructure

Cette procédure cible la VM ARM64 OCI `VM.Standard.A1.Flex` prévue (2 OCPU,
12 Go de RAM), avec Docker Compose. Caddy est
le seul service exposé. Next.js et PostgreSQL restent sur des réseaux Docker
privés, les images produits et les certificats utilisent des volumes
persistants, et les migrations sont exécutées avant le démarrage de
l'application.

## 1. Prérequis

- une VM Ubuntu 24.04 ARM64, avec au moins 2 OCPU, 12 Go de RAM et 40 Go de
  stockage ;
- Docker Engine avec le plugin Docker Compose ;
- le domaine public, le sous-domaine admin et `www` configurés comme décrit
  dans [PUBLIC_DOMAIN_ROLLOUT.md](PUBLIC_DOMAIN_ROLLOUT.md) ;
- une adresse e-mail valide pour les certificats ACME ;
- les ports TCP `80` et `443`, ainsi que UDP `443`, autorisés dans le Network
  Security Group OCI ;
- le port TCP `22` limité à l'adresse IP de l'administrateur. Ne jamais ouvrir
  PostgreSQL `5432` sur Internet.

OCI applique le filtrage réseau dans le NSG ou la security list **et** dans le
pare-feu du système d'exploitation. Les deux niveaux doivent autoriser HTTP et
HTTPS.

## 2. Installation sur la VM

Installer Docker depuis le dépôt officiel Docker adapté à la distribution,
puis cloner le dépôt :

```bash
git clone https://github.com/ahmed-MH/edebou.git
cd edebou
```

Créer les secrets sans les saisir manuellement. Cette commande utilise Node
dans un conteneur et conserve la propriété du fichier pour l'utilisateur SSH :

```bash
docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$PWD:/app" \
  --workdir /app \
  node:22-bookworm-slim \
node scripts/generate-oracle-env.mjs example.com admin@example.com
```

Si Node.js 22 est déjà installé sur la VM, la commande équivalente est
`npm run oracle:env -- example.com admin@example.com`.

Le script crée `.env.oracle` avec des secrets distincts et les permissions
`0600`. Remplacer les deux valeurs d'exemple par le vrai domaine et l'e-mail.
Ne jamais ajouter ce fichier à Git, à une image Docker ou à une sauvegarde non
chiffrée.

Les secrets sont injectés dans l'environnement des conteneurs : un
administrateur Docker peut donc les inspecter. Restreindre Docker et le fichier
`.env.oracle` à l'administrateur de déploiement. Une migration vers Docker
Secrets ou OCI Vault demandera une évolution d'architecture ; elle n'est pas
simulée par cette configuration mono-VM.

Valider la configuration sans démarrer les services :

```bash
docker compose --env-file .env.oracle -f compose.oracle.yaml config --quiet
```

## 3. Premier démarrage

Le DNS doit déjà pointer vers la VM et les ports 80/443 doivent être ouverts,
sinon Caddy ne pourra pas obtenir le certificat public.

```bash
docker compose --env-file .env.oracle -f compose.oracle.yaml up -d --build
docker compose --env-file .env.oracle -f compose.oracle.yaml ps
docker compose --env-file .env.oracle -f compose.oracle.yaml logs --tail=100 caddy app migrate
```

La séquence est volontairement ordonnée : PostgreSQL initialise les rôles,
`provision` prépare les accès checkout/admin, `migrate` applique les migrations,
puis Next.js et Caddy démarrent. PostgreSQL et Next.js n'ont aucun port publié
sur l'hôte.

Vérifier ensuite la disponibilité publique et la connexion interne aux bases :

```bash
curl --fail --silent --show-error https://shop.example.com/api/health/live
docker compose --env-file .env.oracle -f compose.oracle.yaml exec -T app \
  node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async r => { console.log(r.status, await r.text()); process.exit(r.ok ? 0 : 1) })"
```

`live` confirme que le processus répond. `ready` vérifie également les trois
connexions PostgreSQL de moindre privilège. L'endpoint `ready` est bloqué par
Caddy et n'est accessible que depuis les réseaux Docker privés.

`HSTS_MAX_AGE` vaut initialement `0`. Après validation du certificat, des
redirections HTTPS, du checkout et du back-office en HTTPS, définir
`HSTS_MAX_AGE=31536000`, puis recréer uniquement Caddy :

```bash
docker compose --env-file .env.oracle -f compose.oracle.yaml up -d --no-deps --force-recreate caddy
```

Ne pas ajouter `includeSubDomains` tant que chaque sous-domaine n'est pas
audité et servi exclusivement en HTTPS.

## 4. Création du propriétaire du back-office

La commande est interactive et ne journalise pas le mot de passe :

```bash
docker compose --env-file .env.oracle -f compose.oracle.yaml run --rm --entrypoint npm migrate run admin:create
```

Le back-office est ensuite disponible sur :

```text
https://admin.example.com/admin/login
```

## 5. Mise à jour

Avant une mise à jour, créer une sauvegarde puis reconstruire à partir du code
versionné :

```bash
./deploy/oracle/backup.sh
git pull --ff-only
docker compose --env-file .env.oracle -f compose.oracle.yaml up -d --build --remove-orphans
docker compose --env-file .env.oracle -f compose.oracle.yaml ps
```

Ne pas supprimer les volumes avec `docker compose down --volumes`. Les volumes
`postgres_data`, `product_images` et `caddy_data` contiennent respectivement les
données métier, les photos importées et les certificats TLS.

## 6. Sauvegardes

`deploy/oracle/backup.sh` produit dans `backups/oracle` une archive PostgreSQL,
une archive des images produits, un manifeste contenant le commit déployé et
un fichier de checksums. Aucun secret n'est inclus. Par défaut, les ensembles
locaux de plus de 14 jours sont supprimés. Une sauvegarde locale ne protège pas
contre la perte de la VM :

- copier automatiquement chaque archive vers un bucket OCI Object Storage
  privé et chiffré ;
- appliquer une politique de rétention côté bucket ;
- copier également `.env.oracle` vers un coffre chiffré hors VM, séparément des
  archives applicatives ;
- tester périodiquement la restauration dans un PostgreSQL temporaire :

```bash
./deploy/oracle/verify-restore.sh \
  backups/oracle/edebou-TIMESTAMP.dump \
  backups/oracle/edebou-TIMESTAMP-product-images.tar.gz
```

Le test utilise un conteneur et un stockage éphémères, vérifie les migrations
et les images, puis supprime uniquement cet environnement temporaire. Il ne se
connecte jamais à PostgreSQL de production.

Exemple de tâche cron quotidienne à 02:30 UTC :

```cron
30 2 * * * cd /opt/edebou && ./deploy/oracle/backup.sh >> /var/log/edebou-backup.log 2>&1
```

## 7. Exploitation et sécurité

- appliquer régulièrement les mises à jour de sécurité de la VM et reconstruire
  les images Docker ;
- surveiller l'espace disque, la mémoire, l'état Docker et les endpoints de
  santé ;
- externaliser les journaux avant d'augmenter leur rétention ;
- protéger `.env.oracle` et la clé SSH de la VM ;
- ne définir `CHECKOUT_TRUSTED_PROXY_HOPS` ou `ADMIN_TRUSTED_PROXY_HOPS` à une
  valeur supérieure à `1` que si un Oracle Load Balancer ou un CDN est ajouté,
  après avoir configuré précisément les proxies de confiance ;
- tester le parcours commande, le back-office et la restauration sur une VM de
  staging avant d'ouvrir le trafic public.

Caddy active automatiquement HTTPS et le renouvellement des certificats. HSTS
reste désactivé jusqu'à sa validation explicite selon la section 3.

## 8. Déploiement sans domaine confirmé

Ne pas remplacer `PUBLIC_DOMAIN` par l'adresse IP et ne pas ouvrir temporairement le
checkout ou le back-office en HTTP. Tant qu'un vrai domaine contrôlé n'est pas
confirmé et pointé vers `129.151.228.254`, préparer la VM et les images, mais ne
pas publier Caddy. Pour un test privé, utiliser un tunnel SSH vers l'application
sur un port lié uniquement à `127.0.0.1`, puis conserver les tests de cookies et
d'origine sécurisée pour la validation finale en HTTPS.

## 9. Budgets de ressources

Les valeurs par défaut limitent Next.js à 2 Go (heap Node 1,5 Go), PostgreSQL à
3 Go avec 512 Mo de `shared_buffers`, et Caddy à 512 Mo. Sur la cible 12 Go,
cela laisse une marge importante au noyau, au cache disque, à Docker, aux
migrations et aux pointes. Mesurer avant d'augmenter ces plafonds.

Les images PostgreSQL et Caddy utilisent des tags de correctif explicites. La
base Node est verrouillée par digest multi-architecture : les mises à jour sont
donc volontaires et doivent être suivies d'un build ARM64, des tests et d'un
nouveau contrôle de vulnérabilités.

## 10. Risques connus et critères d'ouverture

Consulter [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) et
[PUBLIC_DOMAIN_ROLLOUT.md](PUBLIC_DOMAIN_ROLLOUT.md) avant chaque mise en
production. L'audit de production doit être à zéro vulnérabilité High ou
Critical et les alertes d'outillage restantes doivent être documentées.

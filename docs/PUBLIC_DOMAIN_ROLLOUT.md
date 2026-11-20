# Ouverture publique de `edebou.live`

Ce runbook publie une seule application Next.js derrière Caddy, avec deux
frontières d'hôte indépendantes :

- `https://edebou.live` : vitrine arabe, avec le français sous `/fr` ;
- `https://www.edebou.live` : redirection permanente vers le domaine racine ;
- `https://admin.edebou.live` : uniquement `/admin`, les Server Actions admin
  et l'API d'import d'images authentifiée.

Les chemins `/admin` et `/api/admin` répondent 404 sur le domaine public. Les
pages de vitrine et les mutations checkout répondent 404 sur le sous-domaine
admin. La même application et la même base restent utilisées ; cette séparation
ne repose pas uniquement sur Caddy, car le proxy Next.js et chaque mutation
admin appliquent aussi la politique.

## Portes avant ouverture

1. La PR doit être revue et fusionnée dans `main`; noter son SHA exact.
2. Vérifier les trois entrées DNS depuis deux résolveurs publics.
3. Produire une nouvelle sauvegarde, valider ses checksums et réussir une
   restauration isolée.
4. Dans OCI, autoriser TCP 80 et TCP 443 vers la VM. UDP 443 est facultatif
   pour HTTP/3. Conserver TCP 22 limité à l'adresse d'administration et ne
   jamais créer de règle pour 3000 ou 5432.
5. Confirmer qu'une deuxième connexion SSH indépendante fonctionne avant et
   après toute modification du pare-feu hôte.
6. Configurer une copie chiffrée hors VM. Une sauvegarde uniquement locale ne
   permet pas d'autoriser du trafic commercial.

## Valeurs non secrètes de `.env.oracle`

Modifier le fichier existant avec `sudoedit`; ne pas le régénérer et ne changer
aucun mot de passe ni pepper :

```dotenv
PUBLIC_DOMAIN=edebou.live
ADMIN_DOMAIN=admin.edebou.live
WWW_DOMAIN=www.edebou.live
PUBLIC_APP_ORIGIN=https://edebou.live
ADMIN_APP_ORIGIN=https://admin.edebou.live
CHECKOUT_ALLOWED_ORIGINS=https://edebou.live
HSTS_MAX_AGE=0
```

Utiliser une adresse ACME valide dans `ACME_EMAIL`. Le fichier reste
`root:root` en mode `0600`.

## Déploiement progressif

Depuis `/opt/edebou`, après la fusion :

```bash
sudo ./deploy/oracle/backup.sh
sudo git fetch --prune origin
sudo git checkout main
sudo git pull --ff-only origin main
sudo docker compose --env-file .env.oracle -f compose.oracle.yaml config --quiet
sudo docker compose --env-file .env.oracle -f compose.oracle.yaml build app migrate
```

Installer les fichiers versionnés sans supprimer les règles Oracle existantes :

```bash
sudo install -o root -g root -m 0755 deploy/oracle/docker-firewall.sh \
  /usr/local/sbin/edebou-docker-firewall
sudo install -o root -g root -m 0644 deploy/oracle/systemd/edebou-firewall.service \
  /etc/systemd/system/edebou-firewall.service
sudo install -o root -g root -m 0644 deploy/oracle/systemd/edebou-stack.service \
  /etc/systemd/system/edebou-stack.service
sudo systemctl daemon-reload
```

Avant `systemctl restart edebou-firewall`, conserver une session SSH ouverte,
sauvegarder `iptables-save` et `ip6tables-save`, puis ouvrir une deuxième
connexion. Le script ne modifie que la chaîne Docker dédiée `EDEBOU-DOCKER` :
il autorise les ports originaux 80/443 de Caddy et refuse les autres
publications Docker sur l'interface publique.

Après validation des règles OCI :

```bash
sudo systemctl restart edebou-firewall
sudo iptables -S EDEBOU-DOCKER
sudo systemctl reload edebou-stack
sudo docker compose --env-file .env.oracle -f compose.oracle.yaml ps
sudo docker compose --env-file .env.oracle -f compose.oracle.yaml logs \
  --tail=150 caddy app migrate
```

Ne jamais utiliser `docker compose down -v`, `down --volumes`, `prisma reset`
ou `prisma migrate dev` sur cette VM.

## Validation HTTPS et séparation

```bash
curl -I https://edebou.live/
curl -I https://edebou.live/fr
curl -I https://www.edebou.live/fr/products
curl -I https://admin.edebou.live/
curl -I https://admin.edebou.live/admin/login
curl -I https://edebou.live/admin/login
curl -I https://admin.edebou.live/products
curl -I https://admin.edebou.live/api/orders
```

Résultats attendus : vitrine 200, `www` 308 vers le domaine racine, racine
admin 308 vers `/admin/login`, connexion admin 200, et les trois croisements de
surface 404. Vérifier aussi le certificat des trois noms, la CSP à nonce, les
cookies `__Host-` sans attribut `Domain`, `Secure`, `HttpOnly`,
`SameSite=Strict`, ainsi que l'absence de ports publics 3000/5432.

Créer ensuite le premier propriétaire dans un terminal interactif, sans
journaliser son mot de passe :

```bash
sudo docker compose --env-file .env.oracle -f compose.oracle.yaml \
  run --rm --entrypoint npm migrate run admin:create
```

Après validation du login, des imports, d'une commande contrôlée, du stock et
du renouvellement Caddy, HSTS peut passer progressivement à une durée courte,
puis à `31536000`. Ne pas ajouter `includeSubDomains` avant audit de tous les
sous-domaines.

## Retour arrière

En cas de défaut applicatif, remettre le SHA précédent avec un `git checkout`
explicite puis reconstruire `app` et `migrate`; les migrations doivent rester
compatibles et ne sont jamais annulées par suppression de volume. En cas de
problème TLS ou réseau, arrêter uniquement Caddy et restaurer les sauvegardes
iptables conservées. PostgreSQL, ses volumes et les images produits restent en
place.

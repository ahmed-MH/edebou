# Sécurité — EDebou

## Statut et limites de cette phase

Cette phase ajoute un back-office authentifié et la capture temporaire des formulaires de commande non finalisés aux fondations e-commerce existantes. Elle n'est pas une homologation de production et ne remplace ni revue indépendante, ni test d'intrusion, ni supervision opérationnelle.

Deux mutations publiques POST-only existent : création d'une commande et enregistrement temporaire d'une demande incomplète. Aucune route publique ne permet de lister ou relire les commandes/demandes. Il n'existe aucun compte client ni paiement en ligne. Le back-office repose sur des sessions serveur, des rôles et un journal d'audit ; la supervision et le déploiement durci restent hors de cette phase.

## Mesures présentes

### Dépendances et secrets

- Les installations reproductibles passent par `npm ci` et le `package-lock.json` versionné.
- Prisma 7.10.1, son adaptateur PostgreSQL officiel, `pg` et Zod sont verrouillés dans le lockfile. Prisma 8 n'est pas utilisé tant qu'il reste en préversion.
- Les fichiers locaux `.env.local` et `.env.database` sont exclus de Git ; seuls `.env.example` et `.env.database.example`, dont les mots de passe et URL restent vides, sont versionnés.
- `.env.local`, chargé automatiquement par Next.js, contient les deux URL runtime de moindre privilège, les origines checkout, deux peppers HMAC distincts et la topologie proxy. Les secrets bootstrap/migration/shadow/seed restent dans `.env.database`, dont le nom n'est pas chargé automatiquement par Next.js.
- Les scripts passent explicitement `.env.database` à Compose, Prisma, au seed et au contrôle d'intégration. Les URL sont exclusivement serveur et ne sont jamais lues depuis un composant client.
- Les URL catalogue, checkout, administration et migration utilisent quatre comptes distincts. Next.js ne reçoit jamais le secret bootstrap ou l'URL de migration.
- Le préfixe `NEXT_PUBLIC_` est interdit pour tout mot de passe, URL PostgreSQL, token, secret ou identifiant privé, car son contenu est intégrable au bundle navigateur.
- `poweredByHeader` est désactivé afin de ne pas publier l'en-tête `X-Powered-By` par défaut.

Un `npm audit` est un signal à analyser, pas une preuve à lui seul. Au 20 novembre 2026, `npm audit --omit=dev` ne signale aucune vulnérabilité. `effect`, dépendance de l'outil Prisma, est verrouillé sur la version corrigée 3.22.1 par un override testé. L'audit complet conserve 7 signalements Moderate, sans High ni Critical, dans la chaîne de lint via `minimatch` GHSA-g3hv-75wg-m249. Aucun `--force` ni downgrade majeur n'a été appliqué.

### PostgreSQL local et moindre privilège

- `compose.yaml` verrouille l'image `postgres:18.6-bookworm`, conserve les données dans un volume nommé et vérifie réellement l'authentification du rôle applicatif avec un `SELECT 1` via `psql`.
- Le port est publié uniquement sur `127.0.0.1`. Le bridge Compose permet ce bind local mais aucune règle ne doit être changée en `0.0.0.0` sur un poste de développement.
- `initdb`, les connexions hôte et les mots de passe de rôles utilisent SCRAM-SHA-256. `trust` n'est jamais activé.
- Le rôle bootstrap est un compte d'administration locale réservé à l'initialisation et aux opérations explicites de récupération/restauration. Il n'est jamais utilisé par Prisma ou Next.js. Le rôle de migration possède la base et le schéma, mais reste sans `SUPERUSER`, `CREATEDB`, `CREATEROLE`, réplication ni bypass RLS.
- Le rôle catalogue possède les mêmes attributs refusés. Il hérite du rôle `NOLOGIN` `edebou_catalog_reader`, qui accorde uniquement `USAGE` sur `public` et `SELECT` sur catégories, produits, images, paliers de prix et réglages.
- Le login checkout distinct hérite de `edebou_checkout_writer`. Ses privilèges sont accordés par colonnes : lectures nécessaires au calcul, insertion d'une commande et de ses articles, mise à jour du stock uniquement, et entretien d'une clé de rate limit HMAC. Il ne peut modifier ni prix, catégories, réglages, statut/coordonnées d'une commande existante ou historique Prisma.
- Le login admin distinct hérite de `edebou_admin_writer`. Il peut lire les données métier et appliquer uniquement les mutations prévues ; il ne possède ni le schéma, ni les migrations, ni le droit de créer un compte admin à l'exécution.
- Les demandes incomplètes ne sont pas lisibles par le rôle checkout. Deux fonctions `SECURITY DEFINER` paramétrées, à `search_path` fixe et privées au rôle, réalisent uniquement l'upsert et la conversion autorisés.
- Le runtime catalogue ne peut ni créer d'objet, ni modifier le catalogue, ni lire `orders`, `order_items` ou `_prisma_migrations`. Ces refus et les limites du rôle checkout sont testés sur PostgreSQL avec les fonctions de privilèges et des requêtes négatives réelles.
- La base shadow est distincte, détenue uniquement par le rôle de migration et utilisée seulement par `prisma migrate dev`.
- Le pool runtime est centralisé, limité à 10 connexions et configure des délais de connexion, d'inactivité et d'exécution. La connexion n'est pas ouverte pendant le build.

Le TLS n'est pas désactivé : la connexion locale reste sur la boucle locale. Toute connexion distante future devra rester sur le réseau privé et valider le certificat TLS ; `rejectUnauthorized: false` ne doit pas être introduit comme contournement.

### Intégrité et montants

Tous les montants sont des entiers `BIGINT` exprimés en millimes, avec `1 TND = 1 000 millimes`. Aucun prix n'est stocké en `Float` ou `Decimal`. Les conversions de chaînes décimales évitent de passer par un flottant, et les DTO ne convertissent en `number` qu'après contrôle de la borne publique.

La migration versionnée ajoute des contraintes SQL indépendantes de Zod : montants et stocks non négatifs et bornés, quantité de palier supérieure à 1, unicité d'un palier par produit, cohérence `total = subtotal + delivery_fee`, cohérence `line_total = unit_price * quantity`, formats/longueurs et singleton des réglages. Les clés étrangères définissent explicitement les comportements `RESTRICT`, `CASCADE` ou `SET NULL`.

`prisma migrate dev` est réservé au développement ; `prisma migrate deploy` est la seule commande prévue pour appliquer les migrations en déploiement. `prisma db push`, les resets automatiques et le seed en production sont interdits.

### API publique et commande POST-only

La consultation est limitée à `GET /api/categories`, `GET /api/products` et `GET /api/products/[slug]`. Les mutations publiques sont `POST /api/orders` et `POST /api/checkout-intents`. Leurs variantes GET sont refusées et aucune route de détail client n'existe.

- les paramètres inconnus ou dupliqués sont refusés ; page `1..1000`, taille `1..24`, recherche limitée à 80 caractères et slugs stricts ;
- le repository applique toujours `isActive = true` au produit et à sa catégorie ;
- Prisma construit les requêtes paramétrées ; les helpers `$queryRawUnsafe` et `$executeRawUnsafe` sont interdits par test ;
- les sélections Prisma et DTO publics excluent identifiants internes, timestamps, état d'activation et stock exact ;
- les images, paliers, catégories et pages possèdent des maxima explicites ;
- les erreurs exposent uniquement un code, un message générique et un identifiant de corrélation, jamais une URL, une requête SQL, Prisma ou une stack trace ;
- les succès de catalogue public peuvent être mis en cache brièvement ; les erreurs utilisent `private, no-store`.

Pour le checkout :

- le JSON est strict, limité à 16 Kio, à 20 lignes et 100 unités par ligne ; les champs inconnus, structures trop profondes, produits dupliqués et quantités non entières sont refusés ;
- seuls le slug, la quantité, la locale, les coordonnées de livraison et une UUID v4 d'idempotence sont acceptés. Tout prix, remise, frais ou total envoyé par le client provoque un rejet ;
- prix de base, meilleur palier, frais `StoreSettings` et total sont recalculés en `BIGINT` millimes dans une transaction `Serializable` courte ;
- le stock est décrémenté par mise à jour conditionnelle et l'ensemble commande/articles/stock est annulé au moindre échec. Seuls les conflits de sérialisation transitoires (`P2034` ou SQLSTATE `40001` encapsulé par l'adaptateur) sont repris, au maximum trois tentatives ;
- la clé d'idempotence et la requête canonique sont HMACées avant stockage. Même clé et même requête rejouent la confirmation minimale ; même clé et contenu différent renvoient 409 ;
- la confirmation ne contient que le numéro, les montants, `TND` et l'état initial. Les réponses utilisent `private, no-store` et n'exposent aucune coordonnée ;
- `Origin` est obligatoire et comparé à une allowlist d'origines exactes. `Sec-Fetch-Site`, le type JSON et l'en-tête dédié `X-EDebou-CSRF: 1` sont vérifiés ; aucune confiance n'est accordée à `Host` ou `X-Forwarded-Host` ;
- la limite de débit est atomique et partagée via PostgreSQL. L'adresse client est extraite depuis la droite de `X-Forwarded-For` selon un nombre exact de proxies de confiance, puis HMACée ; aucune IP en clair n'est stockée. La production refuse une topologie à zéro proxy ;
- les journaux d'erreur ne contiennent ni corps, ni adresse, ni téléphone, ni message SQL. Une indisponibilité de la configuration ou de PostgreSQL renvoie 503 et ne produit jamais de confirmation.

Les routes API métier traversent la politique d'hôtes du proxy. Elles reçoivent
les en-têtes défensifs globaux et ajoutent `nosniff`; les contrôles propres à
chaque mutation restent obligatoires et ne reposent jamais uniquement sur le
proxy.

La grille de l'accueil appelle également `catalogService` dans un composant serveur, avec une première page bornée à huit produits actifs. Elle ignore les entrées sans image et conserve les fixtures locales contrôlées si le service échoue, si le catalogue est vide ou si aucun résultat n'est affichable. Ce repli silencieux n'expose aucun détail de connexion dans le HTML, mais il ne constitue ni un contrôle de santé ni une garantie de disponibilité de PostgreSQL : les tests et la supervision de la base et de l'API restent séparés.

### CSP à nonce par requête

Le proxy applicatif génère un nonce avec `crypto.randomUUID()` pour chaque requête de page concernée, l'encode en base64, construit la `Content-Security-Policy`, puis transmet le nonce au rendu Next.js via les en-têtes de requête. La réponse reçoit la même CSP et `Cache-Control: private, no-store`, afin d'éviter de réutiliser une page avec le nonce d'une autre réponse.

Le matcher couvre les pages applicatives et les API afin d'imposer la
séparation entre le domaine public et le sous-domaine admin. Il exclut les
fichiers statiques et l'optimiseur d'images, également filtrés par les routes
Caddy. Les API traitent toujours explicitement leurs en-têtes et leur cache.

En production :

- `script-src` n'autorise que l'origine courante, le nonce de la requête et `strict-dynamic` ;
- `script-src-attr 'none'` bloque les gestionnaires de scripts inline ;
- aucun `unsafe-inline` ni `unsafe-eval` n'est globalement permis pour les scripts ;
- les styles applicatifs sont limités à l'origine courante et au nonce ;
- `style-src-attr 'none'` bloque les attributs de style en production ;
- `img-src` accepte l'origine courante, `data:` et `blob:` pour les images contrôlées de l'interface ;
- les polices, connexions, médias et manifestes sont limités à l'origine courante ;
- `object-src 'none'`, `frame-src 'none'` et `frame-ancestors 'none'` ferment les contenus objets et frames ;
- `base-uri 'self'` et `form-action 'self'` empêchent de rediriger silencieusement les bases d'URL ou formulaires vers une origine tierce ;
- `upgrade-insecure-requests` est ajouté en production.

Les illustrations produit sont de petits SVG locaux rendus avec un élément image natif, différé et dimensionné. Ce choix évite l'attribut `style` généré par `next/image`, incompatible avec `style-src-attr 'none'`. Le smoke test de production refuse tout attribut `style` dans le HTML initial afin de prévenir une régression.

Le mode développement ajoute uniquement ce dont l'outillage Next.js a besoin : `unsafe-eval` pour les scripts, `unsafe-inline` pour les styles et les connexions WebSocket locales. Ces exceptions ne doivent jamais être copiées dans la politique de production.

#### Conséquence sur le rendu et les performances

Un nonce unique n'existe qu'au moment d'une requête. Les pages couvertes doivent donc être rendues à la requête afin que Next.js puisse appliquer le nonce aux scripts générés. Cela réduit les possibilités de rendu entièrement statique, empêche de partager une réponse HTML entre utilisateurs et augmente le travail du serveur. Une CSP à nonce est également incompatible avec une coquille PPR statique qui ne connaît pas le nonce de la requête.

Ce compromis est volontaire pour cette fondation. Il devra être mesuré avant la production (latence, charge et stratégie de cache). Toute évolution vers une CSP par hash/SRI ou une autre stratégie devra conserver une politique stricte et être validée sur le bundle de production ; elle ne doit pas être motivée par la seule suppression de ce coût.

### En-têtes HTTP

La configuration Next.js ajoute, en complément de la CSP :

- `X-Content-Type-Options: nosniff` ;
- `X-Frame-Options: DENY`, renforcé par `frame-ancestors 'none'` dans la CSP ;
- `Referrer-Policy: strict-origin-when-cross-origin` ;
- `Permissions-Policy: browsing-topics=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()` ;
- `Cross-Origin-Opener-Policy: same-origin` ;
- `Cross-Origin-Resource-Policy: same-origin` ;
- `X-DNS-Prefetch-Control: off` ;
- `X-Permitted-Cross-Domain-Policies: none`.

`Strict-Transport-Security` (HSTS) est volontairement différé. Il ne devra être activé par Caddy qu'après validation du HTTPS, des sous-domaines concernés et du renouvellement des certificats. Une valeur HSTS incorrecte peut rendre le domaine indisponible pour les navigateurs pendant sa durée de vie.

### Administration authentifiée

`/admin/login` n'est exposé que sur le sous-domaine admin et ne charge aucune
donnée métier. Les pages sous `/admin` exigent une session aléatoire stockée
uniquement sous forme HMAC en base et liée au navigateur ; le cookie hôte
`__Host-` n'a pas d'attribut `Domain`, est `HttpOnly`, `SameSite=Strict`,
`Secure` en production et expire au plus tard après 24 heures (8 heures par
défaut).

Les tentatives de connexion sont limitées dans PostgreSQL, les comptes sont temporairement verrouillés après échecs répétés et une connexion réussie révoque l'ancienne session du compte. Chaque lecture appelle le DAL de session ; chaque Server Action revérifie session et rôle, ainsi que l'égalité exacte entre `Origin`, l'origine admin configurée et le `Host`/`X-Forwarded-Host` produit par Caddy. Les transitions de commande sont strictes, l'annulation restaure le stock une seule fois et toute mutation est inscrite dans le journal d'audit.

Les mots de passe sont hachés avec `scrypt` et sel aléatoire. Leur création est réservée au script opérateur `admin:create`, exécuté avec le rôle de migration ; le runtime admin ne reçoit volontairement pas le droit d'insérer ou de supprimer des utilisateurs.

Les demandes incomplètes sont conservées 30 jours au maximum puis purgées lors d'un accès administratif. Le score 0–100 est une règle explicable fondée sur la complétude et la récence, pas une prédiction certaine ni un profilage automatisé.

### Surface XSS et injections

Les paramètres et corps sont non fiables et sont validés côté serveur avant le repository. La recherche reste une valeur Prisma. L'insertion de commande éventuellement nécessaire au moindre privilège utilise exclusivement le tag paramétré `Prisma.sql`/`$queryRaw` ; les variantes `Unsafe` sont interdites par test. Le projet n'utilise ni `eval`, ni HTML non fiable. Les coordonnées sont rendues comme texte et ne sont jamais réinjectées dans du HTML.

Le checkout n'utilise pas de cookie d'authentification. Sa défense CSRF combine une origine exacte obligatoire, Fetch Metadata, un type JSON non « simple » et un en-tête dédié. Cette combinaison doit être réévaluée si un cookie de session ou une autre mutation est ajouté ; elle ne dispense pas d'une protection par action adaptée au futur back-office.

### Sauvegarde

Le volume Docker assure la persistance locale mais ne constitue pas une sauvegarde. La procédure opératoire, y compris archive custom, checksum, chiffrement, externalisation et test de restauration, est détaillée dans [POSTGRESQL_BACKUP_RESTORE.md](POSTGRESQL_BACKUP_RESTORE.md).

## Mesures obligatoires avant l'ouverture publique et le back-office

Avant d'exposer un back-office ou d'ouvrir la boutique au public :

1. Mettre en place une authentification serveur maintenue, avec secrets forts injectés à l'exécution, cookies `HttpOnly`, `Secure` en HTTPS et une politique `SameSite` adaptée.
2. Appliquer une autorisation serveur explicite à chaque page privée, Route Handler, Server Action et opération de données ; adopter le moindre privilège et refuser par défaut.
3. Étendre les validateurs et protections CSRF à chaque nouvelle action ; ne pas réutiliser automatiquement le modèle du checkout pour une session administrateur.
4. Configurer Caddy avec le nombre exact de proxies de confiance, vérifier qu'il écrase les en-têtes transmis par le client et tester l'extraction IP en préproduction.
5. Définir une purge opérationnelle des lignes de rate limit expirées et des alertes sur la croissance de cette table ; le rôle runtime ne reçoit volontairement aucun droit `DELETE`.
6. Définir une rotation des peppers HMAC avec période de chevauchement. Une rotation naïve du pepper d'idempotence rendrait les confirmations antérieures introuvables pendant leur fenêtre de rejeu ; l'ancien pepper doit rester vérifiable jusqu'à expiration de cette fenêtre. La rotation du pepper IP réinitialise de fait les clés du rate limiter et doit être coordonnée.
7. Paramétrer toutes les requêtes de données via l'ORM ; ne jamais construire une requête ou du HTML à partir de chaînes non fiables.
8. Définir les règles de cache pour empêcher toute fuite de données privées entre utilisateurs.
9. Journaliser les événements de sécurité utiles sans mots de passe, tokens, cookies, données de paiement ni données personnelles inutiles.
10. Prévoir rotation/révocation des sessions, récupération de compte, journal d'audit administrateur, traitement des annulations avec restauration idempotente du stock et tests d'autorisation négatifs.

## Cible VPS future

L'infrastructure complète est hors périmètre de cette phase. Lorsqu'elle sera créée :

- exécuter le processus Next.js dans un conteneur non-root, avec système de fichiers et capacités minimales ;
- exposer publiquement uniquement Caddy sur les ports HTTP/HTTPS ; garder le port Next.js sur un réseau interne ;
- laisser PostgreSQL accessible uniquement depuis le réseau privé des services, sans publication de son port sur Internet, et exiger TLS avec validation de certificat si la connexion traverse une machine ;
- conserver les rôles bootstrap, migration, catalogue et checkout séparés ; prévoir un rôle de sauvegarde dédié plutôt que de réutiliser un runtime ;
- injecter secrets et configuration au runtime, via des fichiers ou mécanismes aux permissions restreintes, sans les cuire dans l'image ni les transmettre au navigateur ;
- utiliser des volumes persistants pour les données et réaliser des sauvegardes régulières, chiffrées, externalisées et testées par restauration ;
- configurer des journaux structurés, une rotation, une rétention minimale et des alertes, sans données sensibles ;
- maintenir à jour l'OS, Caddy, les images et dépendances, et reconstruire les images de façon reproductible ;
- ajouter health checks, limites de ressources, redémarrage contrôlé et procédure documentée de retour arrière ;
- terminer la validation HTTPS avant d'activer progressivement HSTS.

## Vérifications de livraison

Lancer les contrôles statiques et les tests avant de démarrer le bundle de production :

```bash
npm ci
npm run db:up
npm run db:provision:checkout # volume existant antérieur à la phase 3
npm run db:migrate:deploy
npm run check
npm test
npm run test:database # uniquement local/test ; exécute le seed deux fois
npm run test:checkout-database # uniquement local/test + consentement explicite
npm run build
CHECKOUT_ALLOWED_ORIGINS=https://shop.edebou.test \
CHECKOUT_TRUSTED_PROXY_HOPS=1 \
npm run start -- --hostname 127.0.0.1 --port 3105
# Dans un autre terminal :
npm run test:production -- http://127.0.0.1:3105
npm run test:catalog-api -- http://127.0.0.1:3105
CHECKOUT_API_BASE_URL=http://127.0.0.1:3105 \
CHECKOUT_API_ORIGIN=https://shop.edebou.test \
npm run test:checkout-api
```

`test:database` modifie les fixtures : il exige `NODE_ENV=development` ou `test`, `ALLOW_DEMO_SEED=true` et une `SEED_DATABASE_URL` locale, lance le seed deux fois et compare des instantanés fonctionnels incluant les identifiants, champs métier et relations. Il ne doit jamais cibler la production ni une base dont les fixtures homonymes doivent être conservées.

`test:checkout-database` crée et supprime ses propres fixtures avec le rôle de migration. Il refuse un hôte non local, un environnement autre que développement/test et l'absence de `ALLOW_CHECKOUT_DB_TEST=true`. Il ne doit jamais être activé sur une base contenant des slugs de test à conserver.

Puis vérifier :

- le rendu de `/` et `/fr` sur les formats mobiles et desktop ;
- les en-têtes de production ;
- un nonce différent entre deux requêtes et la correspondance de chaque nonce avec les scripts de sa propre réponse ;
- l'absence de `unsafe-inline` et `unsafe-eval` dans `script-src` en production ;
- l'absence de violations CSP qui cassent une fonctionnalité dans la console navigateur ;
- une redirection vers `/admin/login` pour chaque page métier sans session, une page de connexion LTR et une 404 pour les sous-routes admin inconnues ;
- une réponse 404 pour `/api/admin` et `/api/orders/[numéro]`, 405 pour les lectures des mutations POST-only et pour toute mutation sur l'API catalogue ;
- l'exclusion des produits inactifs, les bornes de pagination, les filtres, les paramètres invalides et les sondes d'injection avec `npm run test:catalog-api` ;
- le refus de mauvais identifiants PostgreSQL et l'isolation effective des rôles avec `npm run test:database` ;
- les paliers serveur, l'idempotence concurrente, la course au dernier stock, le rollback, le rate limiting partagé et les privilèges checkout avec `npm run test:checkout-database` ;
- le succès minimal de `POST /api/orders`, les rejets prix/frais/origine/CSRF et le 503 sans fausse confirmation avec le contrôle HTTP checkout ;
- l'idempotence du seed, que `test:database` lance lui-même deux fois avant de comparer les snapshots ;
- l'absence de secrets dans les fichiers suivis et dans le bundle navigateur ;
- les résultats de `npm audit`, analysés sans déclarer le dépôt sûr sur ce seul critère.

## Résultats vérifiés

- Phase 1, le 11 novembre 2026 : installation reproductible, démarrage développement, lint, TypeScript strict, 6 tests, build de production, smoke test CSP/i18n, QA navigateur mobile/desktop et scans de secrets réussis.
- Phase 2, le 12 novembre 2026 : validation Prisma, migration versionnée avec `migrate deploy`, chemin développement/shadow avec `migrate dev`, contrôles statiques, 29 tests unitaires/statiques, build sans `DATABASE_URL`, smoke test de production et test de l'API catalogue réussis sur PostgreSQL 18.6.
- `npm run test:database` a exécuté le seed deux fois avec des snapshots identiques, puis validé le refus d'un mauvais mot de passe, les attributs `NOSUPERUSER`/`NOCREATEDB`/`NOCREATEROLE`, les limites de connexion, la lecture du seul catalogue par le runtime, le refus des commandes, de `_prisma_migrations`, du DDL et des mutations, ainsi que les contraintes SQL attendues.
- Phase back-office, le 15 novembre 2026 : onze migrations versionnées à jour, 52 tests unitaires/statiques, build Next.js 16.4.6, capture HTTP réelle et contrôle négatif du droit de lecture checkout réussis.
- Le QA navigateur a couvert la connexion admin LTR et la fiche produit mobile avec information de rétention, formulaire intégré et ordre correct des appels à l'action.
- Audit de production : 0 vulnérabilité ; audit complet : 10 Moderate de développement, 0 High, 0 Critical, analysées ci-dessus.

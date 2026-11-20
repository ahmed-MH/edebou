# EDebou

EDebou est une boutique e-commerce tunisienne bilingue arabe/français avec catalogue, panier, commande à la livraison et back-office sécurisé. Le projet n'est pas encore homologué pour une ouverture publique : la supervision, le déploiement durci et une revue de sécurité indépendante restent nécessaires.

Le déploiement Docker durci pour une VM Oracle Cloud est documenté dans
[docs/ORACLE_CLOUD_DEPLOYMENT.md](docs/ORACLE_CLOUD_DEPLOYMENT.md).
L'ouverture de `edebou.live` et l'isolation de `admin.edebou.live` suivent le
runbook [docs/PUBLIC_DOMAIN_ROLLOUT.md](docs/PUBLIC_DOMAIN_ROLLOUT.md).

## Périmètre actuel

- Accueil arabe par défaut, en RTL, et accueil français en LTR.
- Grille d'accueil et catalogue PostgreSQL actif, avec recherche, catégorie, tri, pagination et fiches produit localisées.
- Panier client persistant ne stockant que les slugs et quantités, avec revalidation du catalogue et tarifs par quantité indicatifs.
- Checkout invité tunisien, 24 gouvernorats, téléphone normalisé et paiement à la livraison uniquement.
- Création atomique des commandes par `POST /api/orders`, avec prix/frais recalculés côté serveur, décrément conditionnel du stock, idempotence et limite de débit PostgreSQL partagée.
- API publique de consultation avec validation Zod, DTO explicites, pagination bornée et erreurs maîtrisées.
- Données de démonstration idempotentes, locales et explicitement interdites en production.
- Back-office professionnel sous `/admin` : tableau de bord, commandes, demandes en cours, catalogue, réglages et journal d'audit.
- Capture temporaire des formulaires non finalisés après saisie d'un téléphone tunisien valide, sans route publique de lecture, avec conversion automatique et rétention de 30 jours.
- Politique CSP à nonce par requête et en-têtes HTTP défensifs ; détails dans [docs/SECURITY.md](docs/SECURITY.md).
- PostgreSQL 18.6 isolé par Docker Compose, authentification SCRAM-SHA-256 et rôles distincts pour migration, catalogue, checkout et administration.

Il n'existe ni compte client, ni paiement en ligne, ni endpoint public de lecture des commandes ou demandes. Les pages métier du back-office exigent une session serveur valide ; la confirmation client reste dans la mémoire de la page courante et n'expose ni adresse ni téléphone dans l'URL.

La grille d'accueil interroge `catalogService` côté serveur. Si PostgreSQL est indisponible, elle conserve des fixtures locales contrôlées afin que la vitrine reste lisible. Ce repli ne s'applique ni au catalogue transactionnel ni au checkout et ne peut jamais produire une fausse confirmation de commande.

Les logos officiels fournis sont intégrés sous `public/brand` et l'icône d'application est exposée par le routeur Next.js. Les illustrations produit locales restent des fixtures de démonstration clairement séparées des assets de marque.

## Routes publiques

| Route | Contenu | Langue et direction |
| --- | --- | --- |
| `/` | Accueil | Arabe, RTL |
| `/fr` | Accueil | Français, LTR |
| `/products`, `/fr/products` | Catalogue actif | Arabe / français |
| `/products/[slug]`, `/fr/products/[slug]` | Fiche produit active | Arabe / français |
| `/cart`, `/fr/cart` | Panier local | Arabe / français |
| `/checkout`, `/fr/checkout` | Formulaire de commande | Arabe / français |
| `/api/categories` | Catégories actives | JSON public |
| `/api/products` | Produits actifs, pagination/recherche/filtre | JSON public |
| `/api/products/[slug]` | Détail d'un produit actif | JSON public |
| `POST /api/orders` | Création d'une commande | JSON privé, sans lecture associée |
| `POST /api/checkout-intents` | Enregistrement temporaire d'une demande incomplète | Écriture seule, aucune lecture publique |

La locale est portée par l'URL avec `next-intl`. La détection automatique du navigateur est désactivée : un premier accès à `/` reste donc en arabe. Les entrées de route arabe et française restent très fines et rendent les mêmes composants serveur partagés ; `/ar` et `/ar/*` sont redirigées vers leur forme canonique sans préfixe. Les futures pages suivent ce même modèle : une entrée sans préfixe pour l'arabe, une entrée sous `[locale]` pour le français, et une seule implémentation d'interface partagée.

`/admin/login` publie uniquement le formulaire de connexion. `/admin` et toutes les pages métier redirigent vers cette page sans session valide. `GET /api/orders` et `GET /api/checkout-intents` sont refusés avec 405 ; aucune route ne permet de relire publiquement les coordonnées. L'autorisation est revérifiée côté serveur sur chaque lecture et chaque mutation.

Limite connue de cette phase : le contenu des 404 est traduit, mais le document d'erreur spécial généré par Next.js n'hérite pas de `lang` et `dir` dans son élément `<html>`. Les deux pages publiques les définissent correctement. L'option expérimentale `global-not-found` n'a pas été activée uniquement pour contourner ce comportement.

## Prérequis

- Node.js `^20.19.0`, `^22.13.0` ou `>= 24.0.0`.
- npm et le `package-lock.json` versionné.
- Docker avec Docker Compose.
- Un port PostgreSQL local disponible, `5432` par défaut.

## Configuration locale

Créer deux fichiers locaux séparés, puis renseigner toutes les valeurs laissées vides :

```bash
cp .env.example .env.local
cp .env.database.example .env.database
openssl rand -hex 32
```

Exécuter la commande `openssl` séparément pour les cinq mots de passe PostgreSQL et pour les quatre peppers HMAC checkout/admin. Toutes les valeurs doivent être distinctes. Les valeurs hexadécimales peuvent être placées sans encodage supplémentaire dans les URL locales :

```dotenv
DATABASE_URL=postgresql://edebou_app:APP_PASSWORD@127.0.0.1:5432/edebou
CHECKOUT_DATABASE_URL=postgresql://edebou_checkout:CHECKOUT_PASSWORD@127.0.0.1:5432/edebou
ADMIN_DATABASE_URL=postgresql://edebou_admin:ADMIN_PASSWORD@127.0.0.1:5432/edebou
MIGRATION_DATABASE_URL=postgresql://edebou_migrate:MIGRATION_PASSWORD@127.0.0.1:5432/edebou
SHADOW_DATABASE_URL=postgresql://edebou_migrate:MIGRATION_PASSWORD@127.0.0.1:5432/edebou_shadow
SEED_DATABASE_URL=postgresql://edebou_migrate:MIGRATION_PASSWORD@127.0.0.1:5432/edebou
CHECKOUT_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
CHECKOUT_IDEMPOTENCY_PEPPER=SECRET_ALEATOIRE_DISTINCT
CHECKOUT_IP_HASH_PEPPER=AUTRE_SECRET_ALEATOIRE_DISTINCT
CHECKOUT_TRUSTED_PROXY_HOPS=0
ADMIN_SESSION_HASH_PEPPER=SECRET_SESSION_ADMIN_DISTINCT
ADMIN_IP_HASH_PEPPER=SECRET_IP_ADMIN_DISTINCT
ADMIN_TRUSTED_PROXY_HOPS=0
ADMIN_SESSION_TTL_HOURS=8
```

Placer dans `.env.local` uniquement la configuration runtime : les trois URL de moindre privilège, la liste exacte des origines et les secrets checkout/admin. Placer les secrets d'exploitation, les URL de migration/shadow/seed et les cinq mots de passe de rôles dans `.env.database`.

Next.js charge automatiquement `.env.local` : aucun secret bootstrap, migration, shadow ou seed ne doit donc y apparaître. Les peppers HMAC et l'URL checkout y sont nécessaires côté serveur, mais ne doivent jamais utiliser le préfixe `NEXT_PUBLIC_`. Le nom `.env.database` n'est pas chargé automatiquement ; les scripts d'exploitation le passent explicitement à Compose, Prisma et aux tests. Les deux fichiers locaux sont ignorés par Git, tandis que leurs modèles versionnés conservent tous les secrets et URL vides.

Les rôles ont des responsabilités distinctes :

- `edebou_bootstrap` est le compte d'administration locale réservé à l'initialisation et aux opérations explicites de récupération/restauration ; il n'est utilisé ni par Prisma ni par l'application ;
- `edebou_migrate` possède la base et le schéma mais reste `NOSUPERUSER`, `NOCREATEDB` et `NOCREATEROLE` ;
- `edebou_app` est le runtime limité à la lecture des tables publiques du catalogue via le rôle `NOLOGIN` `edebou_catalog_reader` ; il ne peut lire ni les commandes ni l'historique Prisma ;
- `edebou_checkout` hérite du rôle `NOLOGIN` `edebou_checkout_writer` : lecture des seules colonnes nécessaires au calcul, insertion bornée des commandes/articles, mise à jour du seul stock et entretien du rate limiter haché. Il ne peut modifier ni prix, catégories, réglages, statuts de commande ou coordonnées existantes.
- `edebou_admin` hérite de `edebou_admin_writer` : accès aux données du back-office et mutations métier bornées, sans droits de migration ni de création de compte administrateur à l'exécution.

## Accès au back-office

Après avoir renseigné `POSTGRES_ADMIN_USER`, `POSTGRES_ADMIN_PASSWORD` et `ADMIN_DATABASE_URL` dans `.env.database`, puis `ADMIN_DATABASE_URL` et les deux peppers admin dans `.env.local` :

```bash
npm run db:up
npm run db:provision:admin
npm run db:migrate:deploy
npm run admin:create
npm run dev
```

`admin:create` demande le nom, l'e-mail et un mot de passe fort dans le terminal ; le mot de passe est saisi masqué. Ouvrir ensuite `http://localhost:3000/admin/login`. Si le conteneur PostgreSQL existait avant l'ajout des variables admin, le recréer sans supprimer son volume avec `docker compose --env-file .env.database up -d --force-recreate postgres`, puis relancer le provisionnement.

## Installation et développement

```bash
npm ci
npm run db:up
docker compose --env-file .env.database ps
npm run db:provision:checkout # requis une fois pour un volume créé avant la phase 3
npm run db:provision:admin
npm run db:migrate:dev
```

Pour charger les fixtures locales, mettre temporairement `ALLOW_DEMO_SEED=true` dans `.env.database`, conserver `NODE_ENV=development`, puis lancer :

```bash
npm run db:seed
npm run dev
```

L'application est ensuite disponible sur `http://localhost:3000`.

`npm run dev` utilise Turbopack, le bundler de développement par défaut de
Next.js 16, afin de limiter la mémoire conservée pendant les recompilations.
`npm run dev:webpack` reste disponible uniquement comme solution de repli pour
diagnostiquer une éventuelle incompatibilité.

Sur un volume neuf, le rôle checkout est créé par l'initialisation Docker. Sur un volume existant, `db:provision:checkout` ajoute ou durcit uniquement ce login et son groupe, sans supprimer les données. Il doit précéder la migration de checkout. En production, `CHECKOUT_TRUSTED_PROXY_HOPS=0` est refusé : configurer le nombre exact de proxies maîtrisés qui écrasent ou complètent correctement `X-Forwarded-For`.

Le seed refuse un environnement de production, exige un consentement explicite et n'accepte qu'un hôte PostgreSQL local. Il utilise des `upsert` ; une deuxième exécution ne doit créer aucun doublon.

Commandes d'exploitation locale :

```bash
docker compose --env-file .env.database stop postgres # arrêt, volume conservé
npm run db:up                  # redémarrage
npm run db:logs                # journaux PostgreSQL
npm run db:down                # retire le conteneur/réseau, volume conservé
```

`docker compose --env-file .env.database down --volumes` supprime irréversiblement la base locale ; cette commande n'est jamais lancée par les scripts du projet.

Si la toute première initialisation échoue, consulter d'abord `npm run db:logs`. PostgreSQL peut avoir créé son répertoire de données avant l'échec d'un script d'initialisation ; un simple redémarrage ne rejoue alors pas ces scripts. Uniquement pour une base locale jetable, après avoir confirmé qu'aucune donnée n'est à conserver, supprimer explicitement le volume avec la commande destructive ci-dessus puis recommencer.

## Migrations

- Développement : `npm run db:migrate:dev` crée/applique les migrations et utilise la base shadow distincte.
- Déploiement : `npm run db:migrate:deploy` applique uniquement les migrations versionnées, avec l'URL du rôle de migration injectée par le pipeline.
- Diagnostic : `npm run db:migrate:status`.
- Client : `npm run db:generate` ; `npm ci` le génère également via `postinstall`.

`prisma db push` n'est pas une stratégie de migration et n'est présent dans aucun script. Ne jamais exécuter `migrate dev`, un reset ou le seed contre une base de production.

## Contrôles et exécution de production locale

```bash
npm run lint
npm run typecheck
npm run check
npm test
npm run db:migrate:status
npm run test:database
npm run test:checkout-database
npm run build
npm run start
```

- `lint` exécute ESLint sur le projet.
- `typecheck` vérifie TypeScript sans produire de fichiers.
- `check` regroupe les contrôles statiques configurés.
- `test` lance les tests Node/TypeScript : prix en millimes, validateurs, DTO, services, frontières serveur et contrôles statiques de l'infrastructure.
- `test:database` vérifie les identifiants, migrations, contraintes et privilèges sur PostgreSQL déjà initialisé. Ce test d'intégration n'est pas en lecture seule : il exécute le seed deux fois, compare des instantanés fonctionnels incluant les identifiants, champs métier et relations, puis fait converger les fixtures de démonstration vers les valeurs versionnées.
- `test:checkout-database` crée des fixtures éphémères afin de vérifier les privilèges colonne, les paliers, l'idempotence simultanée, le rollback et la course sur le dernier stock avec une véritable instance PostgreSQL. Il refuse de s'exécuter hors développement/test, hors boucle locale ou sans `ALLOW_CHECKOUT_DB_TEST=true`.
- `build` produit le bundle de production ; `start` sert ce bundle.

`test:database` doit rester limité à une base locale ou de test. Il exige `NODE_ENV=development` ou `test`, `ALLOW_DEMO_SEED=true` et une `SEED_DATABASE_URL` locale utilisant le rôle de migration. Ne jamais le lancer contre une base de production ou une base contenant des fixtures homonymes à préserver.

Après `npm run build`, démarrer le bundle puis vérifier à la fois la phase 1 et l'API :

```bash
CHECKOUT_ALLOWED_ORIGINS=https://shop.edebou.test \
CHECKOUT_TRUSTED_PROXY_HOPS=1 \
npm run start -- --hostname 127.0.0.1 --port 3105
npm run test:production -- http://127.0.0.1:3105
npm run test:catalog-api -- http://127.0.0.1:3105
CHECKOUT_API_BASE_URL=http://127.0.0.1:3105 \
CHECKOUT_API_ORIGIN=https://shop.edebou.test \
npm run test:checkout-api
```

Le transport du smoke test reste sur la boucle locale, tandis que `CHECKOUT_API_ORIGIN` simule l'origine HTTPS exacte exigée en production. Le scénario `test:checkout-api:unavailable` doit être exécuté contre un second processus local démarré avec une `CHECKOUT_DATABASE_URL` volontairement injoignable et la même origine HTTPS de test. Il n'écrit aucune fixture et vérifie uniquement que l'API répond 503, `no-store`, sans fausse confirmation.

Le serveur de développement utilise volontairement quelques assouplissements CSP absents de la production.

## Résultats de vérification

- `npm ci` : réussi depuis le lockfile. npm signale des plages de peer dependencies encore limitées à ESLint 9 dans certains plugins embarqués par `eslint-config-next`, mais l'installation et le lint avec ESLint 10 maintenu réussissent.
- `npm run dev -- --hostname localhost --port 3101` : démarrage réussi et accueil arabe rendu sans erreur de console.
- `npm run check` : réussi (ESLint et TypeScript strict).
- `npm test` : 52 tests sur 52 réussis, couvrant montants, panier, checkout, score explicable, mots de passe admin, paramètres, validation stricte, services, frontières serveur et séparation des secrets.
- Baseline phase 1 du 11 novembre 2026 : installation, contrôles statiques, 6 tests, build, smoke test CSP/i18n, QA navigateur et scans de secrets réussis.
- Phase 2, le 12 novembre 2026 : `npm run db:validate`, `npm run db:migrate:deploy` et le chemin développement/shadow de `npm run db:migrate:dev` ont réussi sur PostgreSQL 18.6 ; `npm run test:database` a exécuté le seed deux fois avec des instantanés fonctionnels identiques, puis validé les bons et mauvais identifiants, l'historique, les contraintes SQL et l'isolation effective des rôles application/migration.
- `npm run build` : réussi avec Next.js 16.4.6 ; les pages restent dynamiques afin de recevoir un nonce par requête et la connexion PostgreSQL n'est ouverte qu'à l'exécution.
- Le smoke test de production vérifie les deux locales, les en-têtes, les nonces frais, la page de connexion admin et les redirections des pages privées.
- `npm run test:catalog-api -- http://127.0.0.1:3220` : réussi sur les catégories, pagination, filtres, recherche littérale, produit actif/inactif, rendu des fiches arabe/française, validation stricte, méthodes refusées, routes sensibles absentes et réponses sans détail interne.
- Phase back-office, le 15 novembre 2026 : onze migrations versionnées, dashboard et pages métier compilés, capture HTTP réelle réussie et rôle checkout confirmé sans droit `SELECT` sur les demandes clients.
- QA navigateur phase 3 : catalogue arabe, fiche produit, ajout et persistance du panier, checkout arabe puis français et rendu desktop vérifiés. La fiche produit est désormais incluse dans le smoke test HTTP afin d'éviter la régression de sérialisation découverte pendant ce contrôle.
- Recherche de secrets : les secrets runtime restent exclus des fichiers suivis et du bundle navigateur ; les pages administratives sont dynamiques et protégées par session serveur.
- `npm audit --omit=dev` : 0 vulnérabilité de production.
- `npm audit` : 10 signalements Moderate, 0 High et 0 Critical. Ils proviennent tous de la chaîne de lint et convergent vers l'avis `minimatch` GHSA-g3hv-75wg-m249. Les corrections proposées par npm imposent actuellement des retours vers ESLint 9 EOL ou Next.js 15 ; aucun `--force` ni downgrade n'a donc été appliqué. Ce point doit être revérifié lors des mises à jour de l'outillage.

## Sauvegarde et déploiement

La procédure `pg_dump`/`pg_restore`, la procédure de test de restauration, le chiffrement et la rétention sont détaillés dans [docs/POSTGRESQL_BACKUP_RESTORE.md](docs/POSTGRESQL_BACKUP_RESTORE.md). Le volume Docker persistant n'est pas une sauvegarde.

La cible envisagée est un VPS Linux avec Caddy, un conteneur Next.js non-root et PostgreSQL sur un réseau interne sans port publié. Le bind `127.0.0.1` de `compose.yaml` est réservé au développement sur le Mac. Les exigences de déploiement, de sauvegarde, de TLS et de journalisation sont documentées dans [docs/SECURITY.md](docs/SECURITY.md).

# Revue de préparation à la production

Dernière revue locale : 2026-11-17.

## Contrôles validés

- lint, TypeScript, 55 tests et validation Prisma ;
- build Next.js 16 standalone et image Linux ARM64 non privilégiée ;
- PostgreSQL 18.6 avec SCRAM, rôles distincts catalogue/checkout/admin/migration
  et aucun port de base publié ;
- migrations appliquées avant le démarrage de l'application ;
- endpoints de vie et de disponibilité, ce dernier étant bloqué publiquement ;
- Caddy seul exposé, HTTPS automatique, journaux bornés et HSTS désactivé par
  défaut jusqu'à validation HTTPS ;
- checkout limité à l'origine HTTPS configurée et confiance proxy fixée à un
  seul saut Caddy ;
- sauvegarde base + images + manifeste + checksums ;
- restauration réelle dans une base PostgreSQL jetable, sans connexion à la
  production.

## Risque dépendance ouvert

`npm audit --omit=dev` signale deux entrées hautes liées à
`next-intl -> @parcel/watcher -> picomatch` :
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).
Au 2026-11-17, le registre npm publie encore `picomatch@4.0.7`, inclus dans la
plage affectée, sans version corrigée disponible. `npm audit fix --dry-run` ne
propose pas de remplacement effectif.

`@parcel/watcher` n'est pas présent dans le runtime standalone livré ; il reste
dans la chaîne d'installation/build. L'image contient aussi une copie compilée
de `picomatch` fournie par Next.js, sans métadonnée de version, que l'audit npm
n'associe pas à cet avis. Mesures temporaires : builds depuis des commits de
confiance, aucune donnée utilisateur transmise à des motifs de build, image
runtime minimale, suivi de `next`, `next-intl`, `@parcel/watcher` et
`picomatch`. Réexécuter l'audit et reconstruire dès publication d'un correctif.

L'audit complet (outils de développement inclus) compte 10 alertes hautes et 6
modérées, aucune critique, après passage d'ESLint 10.14.0 à 10.15.0. Elles
proviennent des chaînes de glob de `eslint-config-next`, TypeScript ESLint et du
watcher ci-dessus. La suggestion automatique restante rétrograderait
`eslint-config-next` vers Next 14 et n'est donc ni sûre ni compatible. Les
commandes lint, typecheck et build restent validées ; réévaluer à chaque mise à
jour amont.

## Portes obligatoires avant ouverture publique

- fusionner une PR revue dans `main` et déployer exactement son SHA ;
- confirmer un domaine contrôlé et pointer son `A` vers l'IP OCI ;
- limiter SSH à l'IP d'administration dans un NSG OCI et ne jamais ouvrir 5432 ;
- valider le certificat, les redirections, le checkout et les cookies admin en
  HTTPS avant d'activer HSTS ;
- créer le premier compte propriétaire par la commande interactive ;
- configurer une copie chiffrée hors VM des sauvegardes et une alerte de santé ;
- exécuter un test fonctionnel réel commande, décrément de stock, images et
  back-office après déploiement.

Sans domaine confirmé, le checkout et le back-office ne doivent pas être
publiés en HTTP. La VM peut être préparée, mais l'ouverture publique reste
bloquée.

# Revue de préparation à la production

Dernière revue locale : 2026-11-20.

## Contrôles validés

- lint, TypeScript, 61 tests et validation Prisma ;
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

## État des dépendances

`npm audit --omit=dev` ne signale aucune vulnérabilité. L'avis High
`GHSA-7589-6fvf-x4pw` affectant la dépendance `effect` de l'outil Prisma est
corrigé par un override verrouillé sur `effect@3.22.1`; `npm ci`, la génération
Prisma, les tests et le build ont été rejoués après ce changement.

L'audit complet conserve 7 alertes Moderate dans la chaîne ESLint/TypeScript
ESLint via `minimatch` (`GHSA-g3hv-75wg-m249`), sans High ni Critical. Elles ne
sont pas copiées dans l'image runtime. Elles restent à réévaluer à chaque mise
à jour amont, sans appliquer de downgrade ou de `npm audit fix --force`.

## Portes obligatoires avant ouverture publique

- fusionner une PR revue dans `main` et déployer exactement son SHA ;
- confirmer un domaine contrôlé et pointer son `A` vers l'IP OCI ;
- appliquer et vérifier la séparation d'hôtes décrite dans
  [PUBLIC_DOMAIN_ROLLOUT.md](PUBLIC_DOMAIN_ROLLOUT.md) ;
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

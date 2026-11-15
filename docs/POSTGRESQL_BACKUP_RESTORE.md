# Sauvegarde et restauration PostgreSQL — EDebou

## Portée

Le volume `edebou_postgres_data` protège les données contre le remplacement du conteneur, mais pas contre une suppression, une corruption, une erreur de migration ou la perte de l'hôte. Une sauvegarde n'est considérée valide qu'après une restauration testée.

Les commandes ci-dessous ciblent le service local `postgres` de `compose.yaml`. Elles évitent de placer un mot de passe dans les arguments de processus ou l'historique du shell. En production, automatiser l'équivalent avec un rôle de sauvegarde dédié, des secrets injectés à l'exécution, du chiffrement et un stockage hors machine.

## Sauvegarde logique locale

1. Vérifier que PostgreSQL est sain et que les migrations sont terminées :

   ```bash
   docker compose --env-file .env.database ps
   npm run db:migrate:status
   ```

2. Créer un répertoire local privé. Il est ignoré par Git :

   ```bash
   install -d -m 700 backups
   BACKUP_FILE="backups/edebou_$(date -u +%Y%m%dT%H%M%SZ).dump"
   ```

3. Produire une archive custom avec le rôle de migration, propriétaire des objets :

   ```bash
   docker compose --env-file .env.database exec -T postgres sh -ceu '
     PGPASSWORD="$POSTGRES_MIGRATION_PASSWORD" pg_dump \
       --host=127.0.0.1 \
       --username="$POSTGRES_MIGRATION_USER" \
       --dbname="$POSTGRES_DB" \
       --format=custom \
       --no-owner \
       --no-acl
   ' > "$BACKUP_FILE"
   test -s "$BACKUP_FILE"
   ```

4. Écrire et vérifier un checksum sur macOS :

   ```bash
   shasum -a 256 "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
   shasum -a 256 -c "$BACKUP_FILE.sha256"
   ```

   Sous Linux, utiliser `sha256sum` et `sha256sum --check`.

L'archive peut contenir des coordonnées de clients dès que les commandes seront activées. Elle doit alors être chiffrée avant de quitter l'hôte, transférée vers un stockage distinct et soumise à une politique de rétention. Le checksum détecte une corruption ; il ne chiffre ni n'authentifie à lui seul la sauvegarde.

## Ce que l'archive ne contient pas

`pg_dump` ne sauvegarde pas les rôles globaux. Les rôles EDebou sont reconstruits par `docker/postgres/init/10-create-roles.sh` avec de nouveaux secrets. L'archive utilise `--no-owner --no-acl` pour rester restaurable sans importer d'anciens propriétaires ou privilèges. Comme `pg_restore` se connecte avec le rôle de migration, les objets restaurés lui appartiennent ; cette propriété est vérifiée ci-dessous. Les ACL, les révocations sur fonctions et les privilèges par défaut doivent être reconstruits explicitement.

Ne pas sauvegarder `pg_authid` ou des hashes de mots de passe dans le dépôt. Ne pas utiliser le rôle applicatif pour `pg_dump` : son accès volontairement limité exclut les commandes et l'historique de migration.

## Test de restauration local

La procédure crée puis supprime uniquement une base jetable nommée `edebou_restore_test`. Vérifier avant de continuer qu'elle ne contient aucune donnée à conserver.

1. Vérifier l'archive et confirmer que la cible n'existe pas :

   ```bash
   shasum -a 256 -c "$BACKUP_FILE.sha256"
   docker compose --env-file .env.database exec -T postgres sh -ceu '
     PGPASSWORD="$POSTGRES_PASSWORD" psql \
       --host=127.0.0.1 \
       --username="$POSTGRES_USER" \
       --dbname=postgres \
       --set=ON_ERROR_STOP=1 \
       --tuples-only \
       --no-align \
       --command="SELECT datname FROM pg_database WHERE datname = '\''edebou_restore_test'\''"
   '
   ```

   La dernière commande ne doit produire aucune ligne. Si elle affiche `edebou_restore_test`, arrêter et examiner cette base ; ne pas la supprimer par supposition.

2. Créer la cible vide avec le bon propriétaire :

   ```bash
   docker compose --env-file .env.database exec -T postgres sh -ceu '
     PGPASSWORD="$POSTGRES_PASSWORD" createdb \
       --host=127.0.0.1 \
       --username="$POSTGRES_USER" \
       --owner="$POSTGRES_MIGRATION_USER" \
       --template=template0 \
       edebou_restore_test
   '
   ```

3. Restaurer avec arrêt immédiat à la première erreur :

   ```bash
   docker compose --env-file .env.database exec -T postgres sh -ceu '
     PGPASSWORD="$POSTGRES_MIGRATION_PASSWORD" pg_restore \
       --host=127.0.0.1 \
       --username="$POSTGRES_MIGRATION_USER" \
       --dbname=edebou_restore_test \
       --exit-on-error \
       --no-owner \
       --no-acl
   ' < "$BACKUP_FILE"
   ```

4. Réappliquer le périmètre exact du lecteur catalogue :

   ```bash
   docker compose --env-file .env.database exec -T postgres sh -ceu '
     PGPASSWORD="$POSTGRES_PASSWORD" psql \
       --host=127.0.0.1 \
       --username="$POSTGRES_USER" \
       --dbname=postgres \
       --set=ON_ERROR_STOP=1 <<"SQL"
   \getenv migration_user POSTGRES_MIGRATION_USER
   \getenv app_user POSTGRES_APP_USER
   \getenv checkout_user POSTGRES_CHECKOUT_USER
   REVOKE ALL ON DATABASE edebou_restore_test FROM PUBLIC;
   SELECT format(
     '\''GRANT CONNECT ON DATABASE edebou_restore_test TO %I'\'',
     :'\''migration_user'\''
   ) \gexec
   SELECT format(
     '\''GRANT CONNECT ON DATABASE edebou_restore_test TO %I'\'',
     :'\''app_user'\''
   ) \gexec
   SELECT format(
     '\''GRANT CONNECT ON DATABASE edebou_restore_test TO %I'\'',
     :'\''checkout_user'\''
   ) \gexec
   SQL
   '

   docker compose --env-file .env.database exec -T postgres sh -ceu '
     PGPASSWORD="$POSTGRES_MIGRATION_PASSWORD" psql \
       --host=127.0.0.1 \
       --username="$POSTGRES_MIGRATION_USER" \
       --dbname=edebou_restore_test \
       --set=ON_ERROR_STOP=1 <<"SQL"
   REVOKE ALL ON SCHEMA public FROM PUBLIC;
   REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
   REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
   REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
   GRANT USAGE ON SCHEMA public TO edebou_catalog_reader;
   REVOKE ALL ON TABLE
     public.orders,
     public.order_items,
     public._prisma_migrations
   FROM edebou_catalog_reader;
   GRANT SELECT ON TABLE
     public.categories,
     public.products,
     public.product_images,
     public.product_price_tiers,
     public.store_settings
   TO edebou_catalog_reader;

   GRANT USAGE ON SCHEMA public TO edebou_checkout_writer;
   REVOKE ALL ON TABLE
     public.categories,
     public.products,
     public.product_price_tiers,
     public.store_settings,
     public.orders,
     public.order_items,
     public.checkout_rate_limits
   FROM edebou_checkout_writer;
   GRANT SELECT (id, is_active)
     ON TABLE public.categories TO edebou_checkout_writer;
   GRANT SELECT (
     id, category_id, sku, slug, name_ar, name_fr, price,
     stock_quantity, is_active
   ) ON TABLE public.products TO edebou_checkout_writer;
   GRANT UPDATE (stock_quantity, updated_at)
     ON TABLE public.products TO edebou_checkout_writer;
   GRANT SELECT (id, product_id, min_quantity, unit_price)
     ON TABLE public.product_price_tiers TO edebou_checkout_writer;
   GRANT SELECT (id, delivery_fee)
     ON TABLE public.store_settings TO edebou_checkout_writer;
   GRANT INSERT (
     order_number, idempotency_key_hash, request_hash, customer_name,
     phone, governorate, address, notes, subtotal, delivery_fee, total
   ) ON TABLE public.orders TO edebou_checkout_writer;
   GRANT SELECT (
     id, order_number, idempotency_key_hash, request_hash,
     subtotal, delivery_fee, total
   ) ON TABLE public.orders TO edebou_checkout_writer;
   GRANT INSERT (
     order_id, product_id, product_name_snapshot, sku_snapshot,
     quantity, unit_price, line_total
   ) ON TABLE public.order_items TO edebou_checkout_writer;
   GRANT SELECT, INSERT ON TABLE public.checkout_rate_limits
     TO edebou_checkout_writer;
   GRANT UPDATE (window_started_at, request_count, updated_at)
     ON TABLE public.checkout_rate_limits TO edebou_checkout_writer;
   SQL
   '
   ```

5. Vérifier l'historique, les données et les contraintes essentielles :

   ```bash
   docker compose --env-file .env.database exec -T postgres sh -ceu '
     PGPASSWORD="$POSTGRES_MIGRATION_PASSWORD" psql \
       --host=127.0.0.1 \
       --username="$POSTGRES_MIGRATION_USER" \
       --dbname=edebou_restore_test \
       --set=ON_ERROR_STOP=1 \
       --command="SELECT migration_name, finished_at FROM public._prisma_migrations ORDER BY started_at" \
       --command="SELECT count(*) AS products FROM public.products" \
       --command="SELECT count(*) AS constraints FROM pg_constraint WHERE connamespace = '\''public'\''::regnamespace" \
       --command="SELECT schemaname, tablename, tableowner FROM pg_tables WHERE schemaname = '\''public'\'' AND tableowner <> current_user" \
       --command="SELECT defaclobjtype, defaclacl FROM pg_default_acl WHERE defaclrole = current_user::regrole"
   '
   ```

   La requête de propriétaires ne doit produire aucune ligne. Les privilèges par défaut doivent refléter les révocations `PUBLIC` appliquées à l'étape précédente.

   Une validation de production doit aussi comparer des comptages attendus, tester les lectures applicatives avec un compte dédié à la base restaurée et exécuter les smoke tests contre cette cible isolée.

6. Après validation et uniquement si cette base est bien jetable, la supprimer explicitement :

   ```bash
   docker compose --env-file .env.database exec -T postgres sh -ceu '
     PGPASSWORD="$POSTGRES_PASSWORD" dropdb \
       --host=127.0.0.1 \
       --username="$POSTGRES_USER" \
       --force \
       edebou_restore_test
   '
   ```

## Restauration après sinistre

1. Provisionner une version PostgreSQL compatible et entièrement patchée.
2. Initialiser les rôles avec de nouveaux mots de passe ; ne pas réutiliser les secrets compromis.
3. Créer une base vide détenue par le rôle de migration.
4. Vérifier le checksum et déchiffrer l'archive dans un emplacement temporaire protégé.
5. Restaurer avec `pg_restore --exit-on-error --no-owner --no-acl`.
6. Réappliquer uniquement les privilèges catalogue ci-dessus.
7. Vérifier migrations, contraintes, comptages et API avant de basculer le trafic.
8. Détruire de manière sûre les copies temporaires en fonction du support et de la politique de l'hébergeur.

## Politique minimale recommandée

- sauvegardes automatiques quotidiennes et avant toute migration risquée ;
- plusieurs points de restauration, dont au moins une copie hors hôte ;
- chiffrement en transit et au repos, avec clés séparées des archives ;
- accès et restauration journalisés ;
- alertes en cas d'échec ou d'archive vide ;
- restauration complète testée régulièrement sur une cible isolée ;
- rétention alignée sur les obligations tunisiennes applicables aux données clients.

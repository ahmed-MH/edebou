#!/bin/sh
set -eu

: "${POSTGRES_USER:?Database initialization refused: POSTGRES_USER is required.}"
: "${POSTGRES_PASSWORD:?Database initialization refused: POSTGRES_PASSWORD is required.}"
: "${POSTGRES_DB:?Database initialization refused: POSTGRES_DB is required.}"
: "${POSTGRES_MIGRATION_USER:?Database initialization refused: POSTGRES_MIGRATION_USER is required.}"
: "${POSTGRES_MIGRATION_PASSWORD:?Database initialization refused: POSTGRES_MIGRATION_PASSWORD is required.}"
: "${POSTGRES_APP_USER:?Database initialization refused: POSTGRES_APP_USER is required.}"
: "${POSTGRES_APP_PASSWORD:?Database initialization refused: POSTGRES_APP_PASSWORD is required.}"
: "${POSTGRES_CHECKOUT_USER:?Database initialization refused: POSTGRES_CHECKOUT_USER is required.}"
: "${POSTGRES_CHECKOUT_PASSWORD:?Database initialization refused: POSTGRES_CHECKOUT_PASSWORD is required.}"
: "${POSTGRES_SHADOW_DB:?Database initialization refused: POSTGRES_SHADOW_DB is required.}"

validate_identifier() {
  identifier_name=$1
  identifier_value=$2

  case "$identifier_value" in
    *[!a-z0-9_]* | "")
      echo "Database initialization refused: $identifier_name must use only lowercase ASCII letters, digits, and underscores." >&2
      exit 1
      ;;
  esac
}

validate_identifier POSTGRES_USER "$POSTGRES_USER"
validate_identifier POSTGRES_DB "$POSTGRES_DB"
validate_identifier POSTGRES_MIGRATION_USER "$POSTGRES_MIGRATION_USER"
validate_identifier POSTGRES_APP_USER "$POSTGRES_APP_USER"
validate_identifier POSTGRES_CHECKOUT_USER "$POSTGRES_CHECKOUT_USER"
validate_identifier POSTGRES_SHADOW_DB "$POSTGRES_SHADOW_DB"

if [ "${#POSTGRES_PASSWORD}" -lt 24 ] || \
   [ "${#POSTGRES_MIGRATION_PASSWORD}" -lt 24 ] || \
   [ "${#POSTGRES_APP_PASSWORD}" -lt 24 ] || \
   [ "${#POSTGRES_CHECKOUT_PASSWORD}" -lt 24 ]; then
  echo "Database initialization refused: all role passwords must contain at least 24 characters." >&2
  exit 1
fi

if [ "$POSTGRES_PASSWORD" = "$POSTGRES_MIGRATION_PASSWORD" ] || \
   [ "$POSTGRES_PASSWORD" = "$POSTGRES_APP_PASSWORD" ] || \
   [ "$POSTGRES_PASSWORD" = "$POSTGRES_CHECKOUT_PASSWORD" ] || \
   [ "$POSTGRES_MIGRATION_PASSWORD" = "$POSTGRES_APP_PASSWORD" ] || \
   [ "$POSTGRES_MIGRATION_PASSWORD" = "$POSTGRES_CHECKOUT_PASSWORD" ] || \
   [ "$POSTGRES_APP_PASSWORD" = "$POSTGRES_CHECKOUT_PASSWORD" ]; then
  echo "Database initialization refused: bootstrap, migration, and application passwords must differ." >&2
  exit 1
fi

if [ "$POSTGRES_USER" = "$POSTGRES_MIGRATION_USER" ] || \
   [ "$POSTGRES_USER" = "$POSTGRES_APP_USER" ] || \
   [ "$POSTGRES_USER" = "$POSTGRES_CHECKOUT_USER" ] || \
   [ "$POSTGRES_MIGRATION_USER" = "$POSTGRES_APP_USER" ] || \
   [ "$POSTGRES_MIGRATION_USER" = "$POSTGRES_CHECKOUT_USER" ] || \
   [ "$POSTGRES_APP_USER" = "$POSTGRES_CHECKOUT_USER" ]; then
  echo "Database initialization refused: bootstrap, migration, application, and checkout users must be distinct." >&2
  exit 1
fi

if [ "$POSTGRES_USER" = "edebou_catalog_reader" ] || \
   [ "$POSTGRES_MIGRATION_USER" = "edebou_catalog_reader" ] || \
   [ "$POSTGRES_APP_USER" = "edebou_catalog_reader" ] || \
   [ "$POSTGRES_CHECKOUT_USER" = "edebou_catalog_reader" ] || \
   [ "$POSTGRES_USER" = "edebou_checkout_writer" ] || \
   [ "$POSTGRES_MIGRATION_USER" = "edebou_checkout_writer" ] || \
   [ "$POSTGRES_APP_USER" = "edebou_checkout_writer" ] || \
   [ "$POSTGRES_CHECKOUT_USER" = "edebou_checkout_writer" ]; then
  echo "Database initialization refused: login roles must differ from fixed group roles." >&2
  exit 1
fi

if [ "$POSTGRES_APP_USER" = "postgres" ] || [ "$POSTGRES_CHECKOUT_USER" = "postgres" ]; then
  echo "Database initialization refused: runtime roles must not be postgres." >&2
  exit 1
fi

case "$POSTGRES_DB" in
  postgres | template0 | template1)
    echo "Database initialization refused: POSTGRES_DB must not name a system database." >&2
    exit 1
    ;;
esac

case "$POSTGRES_SHADOW_DB" in
  postgres | template0 | template1)
    echo "Database initialization refused: POSTGRES_SHADOW_DB must not name a system database." >&2
    exit 1
    ;;
esac

if [ "$POSTGRES_DB" = "$POSTGRES_SHADOW_DB" ]; then
  echo "Database initialization refused: application and shadow database names must differ." >&2
  exit 1
fi

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 <<'SQL'
\getenv migration_user POSTGRES_MIGRATION_USER
\getenv migration_password POSTGRES_MIGRATION_PASSWORD
\getenv app_user POSTGRES_APP_USER
\getenv app_password POSTGRES_APP_PASSWORD
\getenv checkout_user POSTGRES_CHECKOUT_USER
\getenv checkout_password POSTGRES_CHECKOUT_PASSWORD
\getenv app_db POSTGRES_DB
\getenv shadow_db POSTGRES_SHADOW_DB

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5',
  :'migration_user',
  :'migration_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'migration_user'
) \gexec

SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 5',
  :'migration_user',
  :'migration_password'
) \gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT 20',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_user'
) \gexec

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT 20',
  :'checkout_user',
  :'checkout_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'checkout_user'
) \gexec

SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT 20',
  :'checkout_user',
  :'checkout_password'
) \gexec

SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT 20',
  :'app_user',
  :'app_password'
) \gexec

SELECT
  'CREATE ROLE edebou_catalog_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'edebou_catalog_reader'
) \gexec

ALTER ROLE edebou_catalog_reader
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

SELECT
  'CREATE ROLE edebou_checkout_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'edebou_checkout_writer'
) \gexec

ALTER ROLE edebou_checkout_writer
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

SELECT format('GRANT edebou_catalog_reader TO %I', :'app_user') \gexec
SELECT format('GRANT edebou_checkout_writer TO %I', :'checkout_user') \gexec

SELECT format('ALTER ROLE %I SET statement_timeout = %L', :'migration_user', '60s') \gexec
SELECT format('ALTER ROLE %I SET lock_timeout = %L', :'migration_user', '10s') \gexec
SELECT format('ALTER ROLE %I SET idle_in_transaction_session_timeout = %L', :'migration_user', '30s') \gexec
SELECT format('ALTER ROLE %I SET statement_timeout = %L', :'app_user', '5s') \gexec
SELECT format('ALTER ROLE %I SET lock_timeout = %L', :'app_user', '2s') \gexec
SELECT format('ALTER ROLE %I SET idle_in_transaction_session_timeout = %L', :'app_user', '10s') \gexec
SELECT format('ALTER ROLE %I SET statement_timeout = %L', :'checkout_user', '5s') \gexec
SELECT format('ALTER ROLE %I SET lock_timeout = %L', :'checkout_user', '2s') \gexec
SELECT format('ALTER ROLE %I SET idle_in_transaction_session_timeout = %L', :'checkout_user', '5s') \gexec

SELECT format(
  'CREATE DATABASE %I OWNER %I TEMPLATE template0 ENCODING %L',
  :'shadow_db',
  :'migration_user',
  'UTF8'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_database WHERE datname = :'shadow_db'
) \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'app_db', :'migration_user') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'app_db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'app_db', :'migration_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'app_db', :'app_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'app_db', :'checkout_user') \gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'shadow_db', :'migration_user') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'shadow_db') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'shadow_db', :'migration_user') \gexec

REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'migration_user') \gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'app_user') \gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'app_user') \gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'checkout_user') \gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'checkout_user') \gexec

SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC',
  :'migration_user'
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC',
  :'migration_user'
) \gexec
SELECT format(
  'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
  :'migration_user'
) \gexec
SQL

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_SHADOW_DB" \
  --set=ON_ERROR_STOP=1 <<'SQL'
\getenv migration_user POSTGRES_MIGRATION_USER

REVOKE ALL ON SCHEMA public FROM PUBLIC;
SELECT format('ALTER SCHEMA public OWNER TO %I', :'migration_user') \gexec
SQL

echo "EDebou database roles and schemas initialized with least privilege."

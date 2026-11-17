#!/bin/sh
set -eu

: "${POSTGRES_USER:?Checkout role provisioning refused: POSTGRES_USER is required.}"
: "${POSTGRES_PASSWORD:?Checkout role provisioning refused: POSTGRES_PASSWORD is required.}"
: "${POSTGRES_DB:?Checkout role provisioning refused: POSTGRES_DB is required.}"
: "${POSTGRES_MIGRATION_USER:?Checkout role provisioning refused: POSTGRES_MIGRATION_USER is required.}"
: "${POSTGRES_MIGRATION_PASSWORD:?Checkout role provisioning refused: POSTGRES_MIGRATION_PASSWORD is required.}"
: "${POSTGRES_APP_USER:?Checkout role provisioning refused: POSTGRES_APP_USER is required.}"
: "${POSTGRES_APP_PASSWORD:?Checkout role provisioning refused: POSTGRES_APP_PASSWORD is required.}"
: "${POSTGRES_CHECKOUT_USER:?Checkout role provisioning refused: POSTGRES_CHECKOUT_USER is required.}"
: "${POSTGRES_CHECKOUT_PASSWORD:?Checkout role provisioning refused: POSTGRES_CHECKOUT_PASSWORD is required.}"

database_host=${POSTGRES_HOST:-127.0.0.1}
database_port=${POSTGRES_PORT:-5432}

case "$POSTGRES_CHECKOUT_USER" in
  *[!a-z0-9_]* | "" | postgres | edebou_catalog_reader | edebou_checkout_writer)
    echo "Checkout role provisioning refused: invalid POSTGRES_CHECKOUT_USER." >&2
    exit 1
    ;;
esac

case "$POSTGRES_MIGRATION_USER:$POSTGRES_APP_USER" in
  *[!a-z0-9_:]* | :* | *:)
    echo "Checkout role provisioning refused: invalid existing role names." >&2
    exit 1
    ;;
esac

if [ "${#POSTGRES_CHECKOUT_PASSWORD}" -lt 24 ]; then
  echo "Checkout role provisioning refused: password must contain at least 24 characters." >&2
  exit 1
fi

if [ "$POSTGRES_CHECKOUT_USER" = "$POSTGRES_USER" ] || \
   [ "$POSTGRES_CHECKOUT_USER" = "$POSTGRES_MIGRATION_USER" ] || \
   [ "$POSTGRES_CHECKOUT_USER" = "$POSTGRES_APP_USER" ] || \
   [ "$POSTGRES_CHECKOUT_PASSWORD" = "$POSTGRES_PASSWORD" ] || \
   [ "$POSTGRES_CHECKOUT_PASSWORD" = "$POSTGRES_MIGRATION_PASSWORD" ] || \
   [ "$POSTGRES_CHECKOUT_PASSWORD" = "$POSTGRES_APP_PASSWORD" ]; then
  echo "Checkout role provisioning refused: checkout credentials must be distinct." >&2
  exit 1
fi

PGPASSWORD="$POSTGRES_PASSWORD" psql \
  --host="$database_host" \
  --port="$database_port" \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --no-password \
  --set=ON_ERROR_STOP=1 <<'SQL'
\getenv checkout_user POSTGRES_CHECKOUT_USER
\getenv checkout_password POSTGRES_CHECKOUT_PASSWORD
\getenv app_db POSTGRES_DB

SELECT
  'CREATE ROLE edebou_checkout_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'edebou_checkout_writer'
) \gexec

ALTER ROLE edebou_checkout_writer
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

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

-- A reused login must not retain privileges inherited from an old group.
SELECT format('REVOKE %I FROM %I', granted_role.rolname, :'checkout_user')
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE member_role.rolname = :'checkout_user'
  AND granted_role.rolname <> 'edebou_checkout_writer'
\gexec

SELECT format('GRANT edebou_checkout_writer TO %I', :'checkout_user') \gexec
SELECT format('ALTER ROLE %I SET statement_timeout = %L', :'checkout_user', '5s') \gexec
SELECT format('ALTER ROLE %I SET lock_timeout = %L', :'checkout_user', '2s') \gexec
SELECT format('ALTER ROLE %I SET idle_in_transaction_session_timeout = %L', :'checkout_user', '5s') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM %I', :'app_db', :'checkout_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'app_db', :'checkout_user') \gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'checkout_user') \gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'checkout_user') \gexec
SQL

echo "EDebou checkout login and least-privilege group provisioned."

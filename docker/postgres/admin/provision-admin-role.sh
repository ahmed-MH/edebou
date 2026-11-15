#!/bin/sh
set -eu

: "${POSTGRES_USER:?Admin role provisioning refused: POSTGRES_USER is required.}"
: "${POSTGRES_PASSWORD:?Admin role provisioning refused: POSTGRES_PASSWORD is required.}"
: "${POSTGRES_DB:?Admin role provisioning refused: POSTGRES_DB is required.}"
: "${POSTGRES_MIGRATION_USER:?Admin role provisioning refused: POSTGRES_MIGRATION_USER is required.}"
: "${POSTGRES_APP_USER:?Admin role provisioning refused: POSTGRES_APP_USER is required.}"
: "${POSTGRES_CHECKOUT_USER:?Admin role provisioning refused: POSTGRES_CHECKOUT_USER is required.}"
: "${POSTGRES_ADMIN_USER:?Admin role provisioning refused: POSTGRES_ADMIN_USER is required.}"
: "${POSTGRES_ADMIN_PASSWORD:?Admin role provisioning refused: POSTGRES_ADMIN_PASSWORD is required.}"

case "$POSTGRES_ADMIN_USER" in
  *[!a-z0-9_]* | "" | postgres | edebou_catalog_reader | edebou_checkout_writer | edebou_admin_writer)
    echo "Admin role provisioning refused: invalid POSTGRES_ADMIN_USER." >&2
    exit 1
    ;;
esac

if [ "${#POSTGRES_ADMIN_PASSWORD}" -lt 24 ]; then
  echo "Admin role provisioning refused: password must contain at least 24 characters." >&2
  exit 1
fi

if [ "$POSTGRES_ADMIN_USER" = "$POSTGRES_USER" ] || \
   [ "$POSTGRES_ADMIN_USER" = "$POSTGRES_MIGRATION_USER" ] || \
   [ "$POSTGRES_ADMIN_USER" = "$POSTGRES_APP_USER" ] || \
   [ "$POSTGRES_ADMIN_USER" = "$POSTGRES_CHECKOUT_USER" ] || \
   [ "$POSTGRES_ADMIN_PASSWORD" = "$POSTGRES_PASSWORD" ] || \
   [ "$POSTGRES_ADMIN_PASSWORD" = "$POSTGRES_MIGRATION_PASSWORD" ] || \
   [ "$POSTGRES_ADMIN_PASSWORD" = "$POSTGRES_APP_PASSWORD" ] || \
   [ "$POSTGRES_ADMIN_PASSWORD" = "$POSTGRES_CHECKOUT_PASSWORD" ]; then
  echo "Admin role provisioning refused: admin credentials must be distinct." >&2
  exit 1
fi

PGPASSWORD="$POSTGRES_PASSWORD" psql \
  --host=127.0.0.1 \
  --username="$POSTGRES_USER" \
  --dbname="$POSTGRES_DB" \
  --no-password \
  --set=ON_ERROR_STOP=1 <<'SQL'
\getenv admin_user POSTGRES_ADMIN_USER
\getenv admin_password POSTGRES_ADMIN_PASSWORD
\getenv app_db POSTGRES_DB

SELECT
  'CREATE ROLE edebou_admin_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'edebou_admin_writer'
) \gexec

ALTER ROLE edebou_admin_writer
  NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;

SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT 10',
  :'admin_user',
  :'admin_password'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'admin_user'
) \gexec

SELECT format(
  'ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT CONNECTION LIMIT 10',
  :'admin_user',
  :'admin_password'
) \gexec

SELECT format('REVOKE %I FROM %I', granted_role.rolname, :'admin_user')
FROM pg_catalog.pg_auth_members AS membership
JOIN pg_catalog.pg_roles AS granted_role
  ON granted_role.oid = membership.roleid
JOIN pg_catalog.pg_roles AS member_role
  ON member_role.oid = membership.member
WHERE member_role.rolname = :'admin_user'
  AND granted_role.rolname <> 'edebou_admin_writer'
\gexec

SELECT format('GRANT edebou_admin_writer TO %I', :'admin_user') \gexec
SELECT format('ALTER ROLE %I SET statement_timeout = %L', :'admin_user', '8s') \gexec
SELECT format('ALTER ROLE %I SET lock_timeout = %L', :'admin_user', '2s') \gexec
SELECT format('ALTER ROLE %I SET idle_in_transaction_session_timeout = %L', :'admin_user', '10s') \gexec
SELECT format('REVOKE ALL ON DATABASE %I FROM %I', :'app_db', :'admin_user') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'app_db', :'admin_user') \gexec
SELECT format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', :'admin_user') \gexec
SELECT format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', :'admin_user') \gexec
SQL

echo "EDebou admin login and least-privilege group provisioned."

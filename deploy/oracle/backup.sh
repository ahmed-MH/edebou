#!/usr/bin/env bash
set -euo pipefail

script_directory=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_root=$(cd -- "$script_directory/../.." && pwd)
environment_file=${1:-"$project_root/.env.oracle"}
backup_directory=${BACKUP_DIRECTORY:-"$project_root/backups/oracle"}
retention_days=${BACKUP_RETENTION_DAYS:-14}

if [[ ! -f "$environment_file" ]]; then
  echo "Environment file not found: $environment_file" >&2
  exit 1
fi

if [[ ! "$retention_days" =~ ^[0-9]+$ ]] || (( retention_days < 1 )); then
  echo "BACKUP_RETENTION_DAYS must be a positive integer." >&2
  exit 1
fi

umask 077
mkdir -p "$backup_directory"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_prefix="edebou-$timestamp"
database_archive="$backup_directory/$backup_prefix.dump"
images_archive="$backup_directory/$backup_prefix-product-images.tar.gz"
manifest="$backup_directory/$backup_prefix-manifest.txt"
checksum="$backup_directory/$backup_prefix.sha256"
temporary_database="$database_archive.partial"
temporary_images="$images_archive.partial"
temporary_manifest="$manifest.partial"
backup_complete=false

cleanup() {
  rm -f "$temporary_database" "$temporary_images" "$temporary_manifest"
  if [[ "$backup_complete" != true ]]; then
    rm -f "$database_archive" "$images_archive" "$manifest" "$checksum"
  fi
}
trap cleanup EXIT

docker compose \
  --env-file "$environment_file" \
  --file "$project_root/compose.oracle.yaml" \
  exec -T postgres sh -eu -c '
    PGPASSWORD="$POSTGRES_MIGRATION_PASSWORD" exec pg_dump \
      --host=127.0.0.1 \
      --username="$POSTGRES_MIGRATION_USER" \
      --dbname="$POSTGRES_DB" \
      --format=custom \
      --compress=9 \
      --no-owner \
      --no-acl
  ' >"$temporary_database"

if [[ ! -s "$temporary_database" ]]; then
  echo "Database backup is empty: $temporary_database" >&2
  exit 1
fi

docker compose \
  --env-file "$environment_file" \
  --file "$project_root/compose.oracle.yaml" \
  run --rm --no-deps --entrypoint tar volumes-init \
  --create --gzip --file=- --directory=/app/storage product-images \
  >"$temporary_images"

if [[ ! -s "$temporary_images" ]]; then
  echo "Product image backup is empty: $temporary_images" >&2
  exit 1
fi

commit_sha=$(git -C "$project_root" rev-parse --verify HEAD 2>/dev/null || printf 'unknown')
{
  printf 'created_utc=%s\n' "$timestamp"
  printf 'git_commit=%s\n' "$commit_sha"
  printf 'database_archive=%s\n' "$(basename "$database_archive")"
  printf 'product_images_archive=%s\n' "$(basename "$images_archive")"
  printf 'restore_test=deploy/oracle/verify-restore.sh\n'
  printf 'secrets_included=false\n'
} >"$temporary_manifest"

mv "$temporary_database" "$database_archive"
mv "$temporary_images" "$images_archive"
mv "$temporary_manifest" "$manifest"

(
  cd "$backup_directory"
  sha256sum \
    "$(basename "$database_archive")" \
    "$(basename "$images_archive")" \
    "$(basename "$manifest")" \
    >"$(basename "$checksum")"
)

backup_complete=true
trap - EXIT

find "$backup_directory" -type f \
  \( -name 'edebou-*.dump' -o -name 'edebou-*-product-images.tar.gz' \
     -o -name 'edebou-*-manifest.txt' -o -name 'edebou-*.sha256' \) \
  -mtime "+$retention_days" -delete

echo "Backup set created: $backup_prefix"
echo "Verify it with deploy/oracle/verify-restore.sh, then copy it to encrypted off-host storage."

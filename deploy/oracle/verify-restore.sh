#!/usr/bin/env bash
set -euo pipefail

database_archive=${1:-}
images_archive=${2:-}

if [[ -z "$database_archive" || ! -f "$database_archive" ]]; then
  echo "Usage: $0 /path/to/edebou-TIMESTAMP.dump [/path/to/product-images.tar.gz]" >&2
  exit 1
fi

backup_directory=$(cd -- "$(dirname -- "$database_archive")" && pwd)
database_archive="$backup_directory/$(basename -- "$database_archive")"
checksum_file="${database_archive%.dump}.sha256"
container_name="edebou-restore-check-$(date +%s)-$$"
restore_directory=""

cleanup() {
  docker rm --force "$container_name" >/dev/null 2>&1 || true
  if [[ -n "$restore_directory" && "$restore_directory" == /tmp/edebou-restore.* ]]; then
    rm -rf -- "$restore_directory"
  fi
}
trap cleanup EXIT INT TERM

if [[ -f "$checksum_file" ]]; then
  (cd "$backup_directory" && sha256sum --check "$(basename "$checksum_file")")
else
  echo "Warning: checksum file not found; database archive integrity was not pre-verified." >&2
fi

docker run --detach --name "$container_name" \
  --tmpfs /var/lib/postgresql:rw,noexec,nosuid,size=1g \
  --env POSTGRES_PASSWORD=restore-only \
  --env POSTGRES_DB=edebou_restore \
  postgres:18.6-bookworm >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$container_name" pg_isready --username=postgres --dbname=edebou_restore >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! docker exec "$container_name" pg_isready --username=postgres --dbname=edebou_restore >/dev/null 2>&1; then
  echo "Temporary PostgreSQL did not become ready." >&2
  exit 1
fi

docker exec -i "$container_name" pg_restore \
  --username=postgres \
  --dbname=edebou_restore \
  --no-owner \
  --no-acl \
  --exit-on-error \
  <"$database_archive"

migration_count=$(docker exec "$container_name" psql \
  --username=postgres --dbname=edebou_restore --tuples-only --no-align \
  --command='SELECT count(*) FROM public._prisma_migrations;')

if [[ ! "$migration_count" =~ ^[1-9][0-9]*$ ]]; then
  echo "Restored database has no recorded Prisma migration." >&2
  exit 1
fi

if [[ -n "$images_archive" ]]; then
  if [[ ! -f "$images_archive" ]]; then
    echo "Product image archive not found: $images_archive" >&2
    exit 1
  fi
  if tar -tzf "$images_archive" | grep -Eq '(^|/)\.\.(/|$)|^/'; then
    echo "Unsafe path found in product image archive." >&2
    exit 1
  fi
  restore_directory=$(mktemp -d /tmp/edebou-restore.XXXXXX)
  tar -xzf "$images_archive" --no-same-owner --directory "$restore_directory"
  test -d "$restore_directory/product-images"
fi

echo "Isolated restore verified: $migration_count migrations; production was not modified."

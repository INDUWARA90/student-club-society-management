#!/bin/sh
# Restores a dump made by scripts/backup.sh into the docker compose stack's MySQL, REPLACING the current data.
#
#   scripts/restore.sh backups/club_management-20260920T020000Z.sql.gz
#   FORCE=1 scripts/restore.sh <file>     skip the confirmation prompt
#
# Run it from the repository root. The backend is stopped while the data is replaced and started again afterwards.
set -eu

if [ $# -ne 1 ]; then
  echo "usage: $0 <backup.sql.gz>" >&2
  exit 2
fi
file="$1"
if [ ! -f "$file" ]; then
  echo "restore: no such file: $file" >&2
  exit 2
fi
if ! gzip -t "$file" 2>/dev/null; then
  echo "restore: $file is not a valid gzip file" >&2
  exit 2
fi

if [ "${FORCE:-}" != "1" ]; then
  printf 'This REPLACES all data in the club_management database with %s. Type "yes" to continue: ' "$file"
  read -r answer
  if [ "$answer" != "yes" ]; then
    echo "restore: cancelled"
    exit 1
  fi
fi

docker compose stop backend
gzip -dc "$file" | docker compose exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" club_management'
docker compose start backend
echo "restore: done"

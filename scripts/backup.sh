#!/bin/sh
# Backs up the club_management MySQL database to a timestamped, gzipped SQL dump and prunes old dumps.
#
#   scripts/backup.sh          take one backup and exit
#   scripts/backup.sh --loop   take a backup every BACKUP_INTERVAL_SECONDS (this is what the compose "backup" service runs)
#
# Configuration (environment variables):
#   MYSQL_PWD                 password for MYSQL_USER (required; mysqldump reads it from the environment)
#   MYSQL_HOST                default: mysql        MYSQL_PORT   default: 3306      MYSQL_USER   default: root
#   DB_NAME                   default: club_management
#   BACKUP_DIR                default: /backups
#   BACKUP_KEEP               how many of the newest dumps to keep, default: 14
#   BACKUP_INTERVAL_SECONDS   default: 86400 (daily), only used with --loop
set -eu

MYSQL_HOST="${MYSQL_HOST:-mysql}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
DB_NAME="${DB_NAME:-club_management}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-86400}"

if [ -z "${MYSQL_PWD:-}" ]; then
  echo "backup: MYSQL_PWD is not set" >&2
  exit 2
fi

backup_once() {
  mkdir -p "$BACKUP_DIR"
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  raw="$BACKUP_DIR/.${DB_NAME}-${stamp}.sql.part"
  partial="$BACKUP_DIR/.${DB_NAME}-${stamp}.sql.gz.part"
  final="$BACKUP_DIR/${DB_NAME}-${stamp}.sql.gz"

  # Dump to a plain file first so a mysqldump failure isn't hidden by the compressor's exit status.
  if ! mysqldump -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" \
      --single-transaction --routines --triggers --no-tablespaces "$DB_NAME" > "$raw"; then
    rm -f "$raw"
    echo "backup: mysqldump failed" >&2
    return 1
  fi
  gzip -c "$raw" > "$partial"
  rm -f "$raw"

  # A complete dump ends with mysqldump's "Dump completed" comment; anything else is a truncated file.
  if ! gzip -dc "$partial" | tail -n 1 | grep -q 'Dump completed'; then
    rm -f "$partial"
    echo "backup: dump looks incomplete, discarded" >&2
    return 1
  fi
  mv "$partial" "$final"
  echo "backup: wrote $final"

  # Keep only the newest BACKUP_KEEP dumps.
  ls -1t "$BACKUP_DIR"/"${DB_NAME}"-*.sql.gz 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while read -r old; do
    rm -f "$old"
    echo "backup: pruned $old"
  done
}

if [ "${1:-}" = "--loop" ]; then
  while true; do
    backup_once || echo "backup: will retry at the next interval" >&2
    sleep "$BACKUP_INTERVAL_SECONDS"
  done
else
  backup_once
fi

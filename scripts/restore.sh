#!/bin/sh
# Restores an encrypted backup (backup service) into a new database and an empty directory.
# Usage: scripts/restore.sh <backup.tar.age> --identity <age private key> --network <docker network>
#          --mongo-uri <mongodb://host:port> --db <new database> --evidence-dir <empty directory>
# It never replaces live data: the live database name is refused and the directory must be empty.
# Paths are relative to where you run it. A backup written by the service is mode 0600 and owned by
# UID 1000: read it as that user (or copy it and fix the owner).
set -eu

if [ "${1:-}" = --container ]; then
  # Runs inside the Alpine backup image, where busybox ash supports pipefail.
  # shellcheck disable=SC3040
  set -o pipefail
  umask 077
  source_db=testflow-db
  : "${RESTORE_MONGO_URI:?set RESTORE_MONGO_URI}"
  : "${RESTORE_DB:?set RESTORE_DB}"
  case $RESTORE_DB in
    "$source_db") echo "restore: $source_db is the live database name; restore into a new one" >&2; exit 1 ;;
    ''|*[!A-Za-z0-9_-]*) echo 'restore: the database name accepts letters, digits, - and _' >&2; exit 1 ;;
  esac
  [ -z "$(ls -A /restore/evidencias)" ] || { echo 'restore: the evidence directory must be empty' >&2; exit 1; }

  work=$(mktemp -d)
  trap 'rm -rf "$work"' EXIT
  decrypt() { age -d -i /restore/identity /restore/backup.tar.age; }

  # Decrypting the database archive first means a wrong key fails before anything is written.
  decrypt | tar -x -C "$work" mongo.archive.gz
  mongorestore --quiet --uri "$RESTORE_MONGO_URI" --gzip --archive="$work/mongo.archive.gz" \
    --nsInclude "$source_db"'.*' --nsFrom "$source_db"'.$collection$' --nsTo "$RESTORE_DB"'.$collection$'
  decrypt | tar -x -C /restore/evidencias --strip-components=1 evidencias_testes
  echo "restore: database $RESTORE_DB and the evidence files restored"
  exit 0
fi

root=$(cd "$(dirname "$0")/.." && pwd -P)
usage() { echo 'usage: scripts/restore.sh <backup.tar.age> --identity <key> --network <network> --mongo-uri <uri> --db <name> --evidence-dir <dir>' >&2; exit 2; }
# The absolute, symlink-free path of an existing file or directory.
absolute() { if [ -d "$1" ]; then (cd "$1" && pwd -P); else (cd "$(dirname "$1")" && printf '%s/%s' "$(pwd -P)" "$(basename "$1")"); fi; }

[ $# -ge 1 ] || usage
backup=$1; shift
identity= network= mongo_uri= db= evidence_dir=
while [ $# -gt 0 ]; do
  [ $# -ge 2 ] || usage
  case $1 in
    --identity) identity=$2 ;;
    --network) network=$2 ;;
    --mongo-uri) mongo_uri=$2 ;;
    --db) db=$2 ;;
    --evidence-dir) evidence_dir=$2 ;;
    *) usage ;;
  esac
  shift 2
done
[ -n "$identity" ] && [ -n "$network" ] && [ -n "$mongo_uri" ] && [ -n "$db" ] && [ -n "$evidence_dir" ] || usage
[ -f "$backup" ] || { echo "restore: $backup is not a file" >&2; exit 1; }
[ -f "$identity" ] || { echo "restore: $identity is not a file" >&2; exit 1; }
[ -d "$evidence_dir" ] || { echo "restore: $evidence_dir is not a directory" >&2; exit 1; }
self=$(absolute "$0")
backup=$(absolute "$backup"); identity=$(absolute "$identity"); evidence_dir=$(absolute "$evidence_dir")
case "$evidence_dir/" in
  "$root/evidencias_testes/"*) echo 'restore: that is the live evidence directory; restore into a new one' >&2; exit 1 ;;
esac

docker build --quiet --tag testflow-backup:local "$root/backup" >/dev/null
docker run --rm --init --user "$(id -u):$(id -g)" --network "$network" \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  -e RESTORE_MONGO_URI="$mongo_uri" -e RESTORE_DB="$db" \
  -v "$self":/restore/restore.sh:ro \
  -v "$backup":/restore/backup.tar.age:ro \
  -v "$identity":/restore/identity:ro \
  -v "$evidence_dir":/restore/evidencias \
  --entrypoint sh testflow-backup:local /restore/restore.sh --container

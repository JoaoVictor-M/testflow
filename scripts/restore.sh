#!/bin/sh
# Restores an encrypted backup (backup service) into a new database and an empty directory.
# Usage: scripts/restore.sh <backup.tar.age> --identity <age private key> --network <docker network>
#          --mongo-uri <mongodb://host:port> --db <new database> --evidence-dir <empty directory>
# It never replaces live data: the live database name is refused and the directory must be empty.
set -eu
cd "$(dirname "$0")/.."

usage() { echo 'usage: scripts/restore.sh <backup.tar.age> --identity <key> --network <network> --mongo-uri <uri> --db <name> --evidence-dir <dir>' >&2; exit 2; }
absolute() { (cd "$(dirname "$1")" && printf '%s/%s' "$PWD" "$(basename "$1")"); }

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

docker build --quiet --tag testflow-backup:local backup >/dev/null
docker run --rm --init --user "$(id -u):$(id -g)" --network "$network" \
  --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges:true \
  -e RESTORE_MONGO_URI="$mongo_uri" -e RESTORE_DB="$db" \
  -v "$(absolute "$backup")":/restore/backup.tar.age:ro \
  -v "$(absolute "$identity")":/restore/identity:ro \
  -v "$(absolute "$evidence_dir")":/restore/evidencias \
  --entrypoint restore.sh testflow-backup:local

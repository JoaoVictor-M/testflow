#!/bin/sh
# Restores a backup into a NEW database and an EMPTY evidence directory; it never replaces live data.
# Mounts: /restore/backup.tar.age, /restore/identity (age private key), /restore/evidencias (target).
# Environment: RESTORE_MONGO_URI (server only, no database) and RESTORE_DB (the new database name).
set -eu -o pipefail
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

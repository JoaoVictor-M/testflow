#!/bin/sh
# Restores a backup into a NEW database and an EMPTY evidence directory; it never replaces live data.
# Verifies SHA-256 checksums and POSIX file modes recorded at backup time.
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

# Decrypting metadata and the database archive first means a wrong key fails before anything is written.
decrypt | tar -x -C "$work" manifest.json checksums.sha256 permissions.txt mongo.archive.gz

# Verify the database archive checksum before restoring into MongoDB.
grep '  mongo\.archive\.gz$' "$work/checksums.sha256" >"$work/mongo.sha256"
[ -s "$work/mongo.sha256" ] || { echo 'restore: missing mongo.archive.gz checksum' >&2; exit 1; }
(cd "$work" && sha256sum -c "$work/mongo.sha256" >/dev/null)

mongorestore --quiet --uri "$RESTORE_MONGO_URI" --gzip --archive="$work/mongo.archive.gz" \
  --nsInclude "$source_db"'.*' --nsFrom "$source_db"'.$collection$' --nsTo "$RESTORE_DB"'.$collection$'

# Preserve recorded file modes while extracting evidence files into the empty target directory.
decrypt | tar -xp --no-overwrite-dir -C /restore/evidencias --strip-components=1 evidencias_testes

# Verify every restored evidence file checksum and permission mode.
sed -n 's#  evidencias_testes/#  #p' "$work/checksums.sha256" >"$work/evidence.sha256"
if [ -s "$work/evidence.sha256" ]; then
  (cd /restore/evidencias && sha256sum -c "$work/evidence.sha256" >/dev/null)
fi
while IFS="$(printf '\t')" read -r expected_mode rel; do
  [ -n "$rel" ] || continue
  sub=${rel#evidencias_testes/}
  actual_mode=$(stat -c '%a' "/restore/evidencias/$sub")
  [ "$actual_mode" = "$expected_mode" ] || {
    echo "restore: permission mismatch for $sub (expected $expected_mode, got $actual_mode)" >&2
    exit 1
  }
done <"$work/permissions.txt"

echo "restore: database $RESTORE_DB and the evidence files restored and verified"

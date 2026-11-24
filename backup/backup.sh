#!/bin/sh
# Encrypted backup of the MongoDB database and the evidence files, as one age file in /backups.
# Only the public key goes in (BACKUP_AGE_RECIPIENT); the private key never reaches this container.
set -eu -o pipefail
umask 077

: "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT to the age public key (age1...)}"
uri=${BACKUP_MONGO_URI:-mongodb://mongodb-service:27017/testflow-db}
[ -w /backups ] || { echo 'backup: /backups is not writable by this user' >&2; exit 1; }

work=$(mktemp -d)
name="testflow-$(date -u +%Y%m%dT%H%M%SZ).tar.age"
trap 'rm -rf "$work" "/backups/.$name.partial"' EXIT

mongodump --quiet --uri "$uri" --gzip --archive="$work/mongo.archive.gz"
tar -c -C "$work" mongo.archive.gz -C / evidencias_testes | age -r "$BACKUP_AGE_RECIPIENT" -o "/backups/.$name.partial"
# A file named testflow-*.tar.age is always complete.
mv "/backups/.$name.partial" "/backups/$name"
echo "backup: $name"

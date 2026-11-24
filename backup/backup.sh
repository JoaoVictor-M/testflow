#!/bin/sh
# Encrypted backup of the MongoDB database and the evidence files, as one age file in /backups.
# Records a consistency window manifest, SHA-256 checksums and POSIX file modes inside the archive.
# Only the public key goes in (BACKUP_AGE_RECIPIENT); the private key never reaches this container.
set -eu -o pipefail
umask 077

: "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT to the age public key (age1...)}"
uri=${BACKUP_MONGO_URI:-mongodb://mongodb-service:27017/testflow-db}
[ -w /backups ] || { echo 'backup: /backups is not writable by this user' >&2; exit 1; }

work=$(mktemp -d)
name="testflow-$(date -u +%Y%m%dT%H%M%SZ).tar.age"
trap 'rm -rf "$work" "/backups/.$name.partial"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mongodump --quiet --uri "$uri" --gzip --archive="$work/mongo.archive.gz"

# Checksums and POSIX modes of the database archive and every evidence file.
(cd "$work" && sha256sum mongo.archive.gz) >"$work/checksums.sha256"
: >"$work/permissions.txt"
file_count=0
total_bytes=0
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  (cd / && sha256sum "$rel") >>"$work/checksums.sha256"
  mode=$(stat -c '%a' "/$rel")
  size=$(stat -c '%s' "/$rel")
  printf '%s\t%s\n' "$mode" "$rel" >>"$work/permissions.txt"
  file_count=$((file_count + 1))
  total_bytes=$((total_bytes + size))
done <<EOF
$(cd / && find evidencias_testes -type f | LC_ALL=C sort)
EOF

completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mongo_sha256=$(awk 'NR==1 { print $1 }' "$work/checksums.sha256")
cat >"$work/manifest.json" <<EOF
{
  "schemaVersion": 1,
  "startedAt": "$started_at",
  "completedAt": "$completed_at",
  "mongoArchive": "mongo.archive.gz",
  "mongoArchiveSha256": "$mongo_sha256",
  "evidenceFileCount": $file_count,
  "evidenceTotalBytes": $total_bytes,
  "checksumFile": "checksums.sha256",
  "permissionsFile": "permissions.txt"
}
EOF

tar -c -C "$work" manifest.json checksums.sha256 permissions.txt mongo.archive.gz -C / evidencias_testes \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "/backups/.$name.partial"
# A file named testflow-*.tar.age is always complete.
mv "/backups/.$name.partial" "/backups/$name"
echo "backup: $name"

#!/bin/sh
# Integration test (check.sh integration): backup -> restore into a new database and directory -> compare.
# It needs the Docker daemon, so check.sh test-scripts skips it. Everything it touches is its own: a
# throwaway MongoDB (tmpfs, Compose project testflow-backup-<worktree folder>, no published port),
# evidence and backup folders under .cache, and age keys generated here. It never mounts the stack's
# volumes (testflow_mongo-data, evidencias_testes) and never stops the stack.
set -eu
cd "$(dirname "$0")/.."

project="testflow-backup-$(basename "$PWD" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n_-' '-')"
database=testflow-db
restored=testflow-db-restored
test_mongo="docker compose -p $project -f docker-compose.teste.yml"
# The backup service of the production file, on the network of the throwaway MongoDB (service alias
# mongodb-service): only the backup container starts, never the production services.
# It runs as the caller (-u), so the test works for any UID, not only 1000.
run_backup() {
  docker compose -p "$project" -f docker-compose.yml --profile tools run --rm --no-deps -T \
    -u "$(id -u):$(id -g)" backup
}
fails=0
pass() { echo "ok   - $label"; }
miss() { echo "FAIL - $label"; fails=$((fails + 1)); }

mkdir -p .cache
tmp=$(mktemp -d .cache/backup-test.XXXXXX)
tmp=$PWD/$tmp
made_live_dir=
cleanup() {
  $test_mongo down --remove-orphans >/dev/null 2>&1 || true
  [ -z "$made_live_dir" ] || rmdir evidencias_testes 2>/dev/null || true
  rm -rf "$tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
mkdir "$tmp/keys" "$tmp/backups" "$tmp/evidence" "$tmp/restored" "$tmp/wrong-restored"

# Evidence with a marker (never allowed in the encrypted file), binary data, nesting and a space.
marker="marker-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
mkdir -p "$tmp/evidence/project-1/scenario 1" "$tmp/evidence/project-2"
printf 'evidence %s\n' "$marker" >"$tmp/evidence/project-1/scenario 1/note.txt"
head -c 20000 /dev/urandom >"$tmp/evidence/project-1/shot.png"
: >"$tmp/evidence/project-2/empty.txt"

$test_mongo down --remove-orphans
$test_mongo up -d --wait mongodb-service
docker compose -p "$project" -f docker-compose.yml --profile tools build --quiet backup

# Disposable age keys: the right pair, and another one that must not open the backup.
keygen() { docker run --rm --user "$(id -u):$(id -g)" -v "$tmp/keys":/keys --entrypoint age-keygen testflow-backup:local -o "/keys/$1" 2>/dev/null; }
keygen right.txt
keygen wrong.txt
public_key=$(sed -n 's/^# public key: //p' "$tmp/keys/right.txt")

mongo() { $test_mongo exec -T mongodb-service mongosh --quiet --eval "$1"; }
mongo "const d = db.getSiblingDB('$database');
  d.users.insertMany([{ _id: 1, name: 'Ana', note: '$marker' }, { _id: 2, name: 'Bruno' }]);
  d.projects.insertOne({ _id: 'p1', title: 'Projeto', members: [1, 2], created: new Date(0) });
  d.projects.createIndex({ title: 1 }, { unique: true })" >/dev/null
# Every collection and index of a database, in a form that compares equal.
snapshot() {
  mongo "const d = db.getSiblingDB('$1');
    print(d.getCollectionNames().sort().map((c) => c + ' ' + EJSON.stringify(d[c].find().sort({ _id: 1 }).toArray())
      + ' ' + EJSON.stringify(d[c].getIndexes())).join('\n'))"
}
live_before=$(snapshot "$database")
restore() { # restore <backup> <identity> <database> <evidence dir>
  sh scripts/restore.sh "$1" --identity "$2" --network "${project}_default" \
    --mongo-uri mongodb://mongodb-service:27017 --db "$3" --evidence-dir "$4"
}

label="the backup service runs and writes one finished file"
BACKUP_AGE_RECIPIENT=$public_key BACKUP_EVIDENCE_DIR=$tmp/evidence BACKUP_DIR=$tmp/backups run_backup >/dev/null 2>&1 || true
set -- "$tmp"/backups/testflow-*.tar.age
backup=$1
if [ $# -eq 1 ] && [ -f "$backup" ] && [ -z "$(find "$tmp/backups" -name '.*')" ]; then pass; else miss; fi

label="the backup is an age file and holds no plain text"
if [ "$(head -c 21 "$backup")" = 'age-encryption.org/v1' ] && ! grep -qa "$marker" "$backup" \
  && ! grep -qa 'AGE-SECRET-KEY' "$backup"; then pass; else miss; fi

label="the backup directory holds no private key"
if ! grep -rqa 'AGE-SECRET-KEY' "$tmp/backups"; then pass; else miss; fi

label="restore with the right key brings the evidence back identical"
restore "$backup" "$tmp/keys/right.txt" "$restored" "$tmp/restored" >/dev/null 2>&1 || true
if diff -r "$tmp/evidence" "$tmp/restored" >/dev/null; then pass; else miss; fi

label="restore with the right key brings every collection and index back, in a new database"
restored_snapshot=$(snapshot "$restored")
if [ -n "$restored_snapshot" ] && [ "$restored_snapshot" = "$live_before" ] \
  && printf '%s' "$restored_snapshot" | grep -q "$marker"; then pass; else miss; fi

label="restore leaves the live database untouched"
if [ "$(snapshot "$database")" = "$live_before" ]; then pass; else miss; fi

label="restore with another key fails and writes nothing"
if restore "$backup" "$tmp/keys/wrong.txt" testflow-db-wrong "$tmp/wrong-restored" >/dev/null 2>&1; then miss
elif [ -z "$(ls -A "$tmp/wrong-restored")" ] && [ -z "$(snapshot testflow-db-wrong)" ]; then pass; else miss; fi

label="restore refuses the live database name"
if restore "$backup" "$tmp/keys/right.txt" "$database" "$tmp/wrong-restored" >/dev/null 2>&1; then miss; else pass; fi

label="restore refuses a directory that already has files"
if restore "$backup" "$tmp/keys/right.txt" testflow-db-again "$tmp/restored" >/dev/null 2>&1; then miss
elif [ -z "$(snapshot testflow-db-again)" ]; then pass; else miss; fi

label="restore refuses the live evidence directory, however the path is written"
[ -d evidencias_testes ] || { mkdir evidencias_testes; made_live_dir=1; }
if restore "$backup" "$tmp/keys/right.txt" testflow-db-live evidencias_testes >/dev/null 2>&1 \
  || restore "$backup" "$tmp/keys/right.txt" testflow-db-live ./scripts/../evidencias_testes/ >/dev/null 2>&1; then miss
elif [ -z "$(snapshot testflow-db-live)" ]; then pass; else miss; fi

label="restore resolves relative paths from where it is run, not from the repository"
mkdir "$tmp/relative"
if (cd "$tmp" && sh "$OLDPWD/scripts/restore.sh" "backups/$(basename "$backup")" --identity keys/right.txt \
  --network "${project}_default" --mongo-uri mongodb://mongodb-service:27017 --db testflow-db-relative \
  --evidence-dir relative) >/dev/null 2>&1 && diff -r "$tmp/evidence" "$tmp/relative" >/dev/null; then pass; else miss; fi

label="the backup refuses to run without the public key and leaves no file"
rm "$backup"
if BACKUP_AGE_RECIPIENT= BACKUP_EVIDENCE_DIR=$tmp/evidence BACKUP_DIR=$tmp/backups run_backup >/dev/null 2>&1; then miss
elif [ -z "$(ls -A "$tmp/backups")" ]; then pass; else miss; fi

label="the backup refuses a private key in place of the public one and leaves no file"
if BACKUP_AGE_RECIPIENT=$(grep '^AGE-SECRET-KEY' "$tmp/keys/right.txt") BACKUP_EVIDENCE_DIR=$tmp/evidence \
  BACKUP_DIR=$tmp/backups run_backup >/dev/null 2>&1; then miss
elif [ -z "$(ls -A "$tmp/backups")" ]; then pass; else miss; fi

[ "$fails" -eq 0 ] && echo "backup: all passed" || { echo "backup: $fails failed" >&2; exit 1; }

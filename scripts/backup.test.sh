#!/bin/sh
# Integration test (check.sh integration): backup -> restore into a new database and directory -> compare,
# plus synthetic joint recovery rehearsal (consistency manifest, checksums, permissions, links,
# interrupted cascade recovery, missing/corrupted file detection and measured RPO/RTO).
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
now_ms() {
  ms=$(date +%s%3N 2>/dev/null || true)
  case "$ms" in
    *[!0-9]*|'') printf '%s000\n' "$(date +%s)" ;;
    *) printf '%s\n' "$ms" ;;
  esac
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

# Evidence with a marker (never allowed in the encrypted file), binary data, nesting, spaces and explicit modes.
marker="marker-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
mkdir -p "$tmp/evidence/D1_Demanda_ativa" "$tmp/evidence/RET1_Demanda_retida" "$tmp/evidence/project-1/scenario 1"
printf 'evidence %s\n' "$marker" >"$tmp/evidence/D1_Demanda_ativa/1700-aaaa-prova.txt"
printf 'retained %s\n' "$marker" >"$tmp/evidence/RET1_Demanda_retida/1700-bbbb-retida.txt"
printf 'note %s\n' "$marker" >"$tmp/evidence/project-1/scenario 1/note.txt"
head -c 20000 /dev/urandom >"$tmp/evidence/project-1/shot.png"
: >"$tmp/evidence/project-1/empty.txt"
chmod 640 "$tmp/evidence/D1_Demanda_ativa/1700-aaaa-prova.txt"
chmod 600 "$tmp/evidence/RET1_Demanda_retida/1700-bbbb-retida.txt"

$test_mongo down --remove-orphans
$test_mongo up -d --wait mongodb-service
docker compose -p "$project" -f docker-compose.yml --profile tools build --quiet backup
docker build --quiet --target prod --tag testflow-rehearsal-app:local testflow-app >/dev/null

# Disposable age keys: the right pair, and another one that must not open the backup.
keygen() { docker run --rm --user "$(id -u):$(id -g)" -v "$tmp/keys":/keys --entrypoint age-keygen testflow-backup:local -o "/keys/$1" 2>/dev/null; }
keygen right.txt
keygen wrong.txt
public_key=$(sed -n 's/^# public key: //p' "$tmp/keys/right.txt")

mongo() { $test_mongo exec -T mongodb-service mongosh --quiet --eval "$1"; }
mongo "const d = db.getSiblingDB('$database');
  const uId = ObjectId('650000000000000000000001');
  const pActive = ObjectId('650000000000000000000010');
  const dActive = ObjectId('650000000000000000000020');
  const sActive = ObjectId('650000000000000000000030');
  const pFailed = ObjectId('650000000000000000000040');
  const dFailed = ObjectId('650000000000000000000050');
  d.users.insertOne({ _id: uId, name: 'Ana', username: 'ana.rehearsal', email: 'ana@example.test', role: 'admin', note: '$marker' });
  d.projects.insertMany([
    { _id: pActive, title: 'Projeto Ativo', status: 'Em Andamento', createdAt: new Date(0) },
    { _id: pFailed, title: 'Projeto Cascata Interrompida', status: 'Em Andamento', createdAt: new Date(0) }
  ]);
  d.projects.createIndex({ title: 1 }, { unique: true });
  d.demandas.insertMany([
    {
      _id: dActive, demandaId: 'D1', nome: 'Demanda ativa', project: pActive, status: 'Testando',
      evidences: [{ filename: '1700-aaaa-prova.txt', originalName: 'prova.txt', mimetype: 'text/plain', size: 32 }]
    },
    {
      _id: dFailed, demandaId: 'RET1', nome: 'Demanda retida', project: pFailed, status: 'Pendente',
      evidences: [{ filename: '1700-bbbb-retida.txt', originalName: 'retida.txt', mimetype: 'text/plain', size: 32 }]
    }
  ]);
  d.scenarios.insertOne({ _id: sActive, title: 'Cenario Ativo', description: 'Desc', steps: ['P1'], expectedResult: 'Ok', demanda: dActive, status: 'Aguardando' });
  d.systemconfigs.insertOne({ key: 'email_settings', value: { host: 'smtp.example.test', port: 587, user: 'mailer', pass: 'redacted-fixture' }, updatedAt: new Date(0) });
  d.cascadedeletionjobs.insertOne({
    _id: ObjectId('650000000000000000000060'),
    targetType: 'Project',
    targetId: pFailed,
    targetLabel: 'Projeto Cascata Interrompida',
    requestedBy: uId,
    status: 'failed',
    phase: 'deleting_demandas',
    failedPhase: 'deleting_demandas',
    errorMessage: 'interrupcao sintetica',
    attempts: 1,
    scope: { projectId: pFailed, demandaIds: [dFailed], demandaCount: 1, scenarioCount: 0 },
    retentionState: 'retained',
    retainedAttachments: [{ demandaId: dFailed, demandaCode: 'RET1', demandaName: 'Demanda retida', relativeDir: 'RET1_Demanda_retida', filename: '1700-bbbb-retida.txt', originalName: 'retida.txt', size: 32 }],
    auditSnapshot: { _id: pFailed, title: 'Projeto Cascata Interrompida' },
    createdAt: new Date(0),
    updatedAt: new Date(0)
  });" >/dev/null
last_commit_ms=$(now_ms)

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
backup_start_ms=$(now_ms)
BACKUP_AGE_RECIPIENT=$public_key BACKUP_EVIDENCE_DIR=$tmp/evidence BACKUP_DIR=$tmp/backups run_backup >/dev/null 2>&1 || true
backup_end_ms=$(now_ms)
backup_ms=$((backup_end_ms - backup_start_ms))
rpo_window_ms=$((backup_end_ms - last_commit_ms))
set -- "$tmp"/backups/testflow-*.tar.age
backup=$1
if [ $# -eq 1 ] && [ -f "$backup" ] && [ -z "$(find "$tmp/backups" -name '.*')" ]; then pass; else miss; fi

label="the backup is an age file and holds no plain text"
if [ "$(head -c 21 "$backup")" = 'age-encryption.org/v1' ] && ! grep -qa "$marker" "$backup" \
  && ! grep -qa 'AGE-SECRET-KEY' "$backup"; then pass; else miss; fi

label="the backup directory holds no private key"
if ! grep -rqa 'AGE-SECRET-KEY' "$tmp/backups"; then pass; else miss; fi

label="the backup archive contains a consistency manifest, checksums and permissions"
manifest_out=$(docker run --rm --user "$(id -u):$(id -g)" \
  -v "$backup":/in/backup.tar.age:ro -v "$tmp/keys/right.txt":/in/id:ro \
  --entrypoint sh testflow-backup:local -c \
  'age -d -i /in/id /in/backup.tar.age | tar -xO manifest.json' 2>/dev/null || true)
if printf '%s' "$manifest_out" | grep -q '"schemaVersion": 1' \
  && printf '%s' "$manifest_out" | grep -q '"startedAt":' \
  && printf '%s' "$manifest_out" | grep -q '"completedAt":' \
  && printf '%s' "$manifest_out" | grep -q '"evidenceFileCount": 5'; then pass; else miss; fi

label="restore with the right key brings the evidence back identical"
restore_start_ms=$(now_ms)
restore "$backup" "$tmp/keys/right.txt" "$restored" "$tmp/restored" >/dev/null 2>&1 || true
restore_end_ms=$(now_ms)
rto_ms=$((restore_end_ms - restore_start_ms))
if diff -r "$tmp/evidence" "$tmp/restored" >/dev/null; then pass; else miss; fi

label="restore with the right key brings every collection and index back, in a new database"
restored_snapshot=$(snapshot "$restored")
if [ -n "$restored_snapshot" ] && [ "$restored_snapshot" = "$live_before" ] \
  && printf '%s' "$restored_snapshot" | grep -q "$marker"; then pass; else miss; fi

label="joint rehearsal verifies inventory, checksums, permissions, links, file loss and cascade recovery"
if docker run --rm -i --user "$(id -u):$(id -g)" --network "${project}_default" \
  -v "$tmp":/rehearsal \
  -v "$PWD/VERSION":/rehearsal/VERSION:ro \
  testflow-rehearsal-app:local node - <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { buildInventory, verifyRestoredInventory } = require('./services/inventoryService');
const { recoverPendingCascades } = require('./services/cascadeDeletionService');
const CascadeDeletionJob = require('./models/CascadeDeletionJob');
const Demanda = require('./models/Demanda');
const Project = require('./models/Project');

(async () => {
    await mongoose.connect('mongodb://mongodb-service:27017/testflow-db-restored', { autoIndex: false, autoCreate: false });
    try {
        const sourceDb = mongoose.connection.client.db('testflow-db');
        const restoredDb = mongoose.connection.client.db('testflow-db-restored');
        const common = {
            allowlistPath: path.resolve(process.cwd(), 'config', 'allowlist.json'),
            versionPath: '/rehearsal/VERSION',
            packageJsonPath: path.resolve(process.cwd(), 'package.json')
        };

        const sourceInv = await buildInventory({ ...common, db: sourceDb, evidenceBaseDir: '/rehearsal/evidence' });
        const restoredInv = await buildInventory({ ...common, db: restoredDb, evidenceBaseDir: '/rehearsal/restored' });
        const report = verifyRestoredInventory(sourceInv, restoredInv);
        assert.equal(report.ok, true, JSON.stringify(report.discrepancies));
        assert.equal(restoredInv.links.activeLinkedCount, 2);
        assert.equal(restoredInv.links.retainedLinkedCount, 1);
        assert.equal(restoredInv.attachments.files.find((f) => f.relativePath.endsWith('1700-aaaa-prova.txt')).mode, '0640');
        assert.equal(restoredInv.attachments.files.find((f) => f.relativePath.endsWith('1700-bbbb-retida.txt')).mode, '0600');

        // Simula perda de arquivo e corrupção em cópias de verificação.
        const copyLoss = '/rehearsal/verify-loss';
        fs.cpSync('/rehearsal/restored', copyLoss, { recursive: true });
        fs.unlinkSync(path.join(copyLoss, 'D1_Demanda_ativa', '1700-aaaa-prova.txt'));
        const lossReport = verifyRestoredInventory(sourceInv, await buildInventory({ ...common, db: restoredDb, evidenceBaseDir: copyLoss }));
        assert.equal(lossReport.ok, false);
        assert.ok(lossReport.discrepancies.some((d) => d.code === 'missing_attachment'));
        assert.ok(lossReport.discrepancies.some((d) => d.code === 'broken_link'));

        const copyCorrupt = '/rehearsal/verify-corrupt';
        fs.cpSync('/rehearsal/restored', copyCorrupt, { recursive: true });
        fs.appendFileSync(path.join(copyCorrupt, 'D1_Demanda_ativa', '1700-aaaa-prova.txt'), 'X');
        const corruptReport = verifyRestoredInventory(sourceInv, await buildInventory({ ...common, db: restoredDb, evidenceBaseDir: copyCorrupt }));
        assert.equal(corruptReport.ok, false);
        assert.ok(corruptReport.discrepancies.some((d) => d.code === 'checksum_mismatch'));

        // Recupera a cascata interrompida no banco restaurado sem apagar o anexo físico retido.
        const rec = await recoverPendingCascades({ evidenceBaseDir: '/rehearsal/restored' });
        assert.equal(rec.recovered.length, 1);
        assert.equal(rec.failed.length, 0);
        assert.equal(await Project.exists({ _id: '650000000000000000000040' }), null);
        assert.equal(await Demanda.exists({ _id: '650000000000000000000050' }), null);
        const recoveredJob = await CascadeDeletionJob.findById('650000000000000000000060').lean();
        assert.equal(recoveredJob.status, 'completed');
        assert.equal(recoveredJob.retentionState, 'retained');
        assert.equal(fs.existsSync('/rehearsal/restored/RET1_Demanda_retida/1700-bbbb-retida.txt'), true);
    } finally {
        await mongoose.disconnect();
    }
})().catch((err) => { console.error(err); process.exit(1); });
NODE
then pass; else miss; fi

label="restore leaves the live database untouched"
if [ "$(snapshot "$database")" = "$live_before" ]; then pass; else miss; fi

label="restore with another key fails and writes nothing"
if restore "$backup" "$tmp/keys/wrong.txt" testflow-db-wrong "$tmp/wrong-restored" >/dev/null 2>&1; then miss
elif [ -z "$(ls -A "$tmp/wrong-restored")" ] && [ -z "$(snapshot testflow-db-wrong)" ]; then pass; else miss; fi

label="restore rejects a backup whose checksum does not match and leaves the target database untouched"
mkdir "$tmp/tampered-restored"
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$backup":/in/backup.tar.age:ro -v "$tmp/keys/right.txt":/in/id:ro -v "$tmp/backups":/out \
  -e PUBLIC_KEY="$public_key" --entrypoint sh testflow-backup:local -c '
    w=$(mktemp -d)
    age -d -i /in/id /in/backup.tar.age | tar -x -C "$w"
    sed "1s/^0/1/; t; 1s/^[0-9a-f]/0/" "$w/checksums.sha256" >"$w/checksums.bad"
    mv "$w/checksums.bad" "$w/checksums.sha256"
    tar -c -C "$w" manifest.json checksums.sha256 permissions.txt mongo.archive.gz evidencias_testes \
      | age -r "$PUBLIC_KEY" -o /out/tampered.tar.age
    rm -rf "$w"
  ' >/dev/null 2>&1
if restore "$tmp/backups/tampered.tar.age" "$tmp/keys/right.txt" testflow-db-tampered "$tmp/tampered-restored" >/dev/null 2>&1; then miss
elif [ -z "$(ls -A "$tmp/tampered-restored")" ] && [ -z "$(snapshot testflow-db-tampered)" ]; then pass; else miss; fi
rm -f "$tmp/backups/tampered.tar.age"

label="restore supports legacy pre-manifest backups containing only database archive and evidence"
mkdir "$tmp/legacy-restored"
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$backup":/in/backup.tar.age:ro -v "$tmp/keys/right.txt":/in/id:ro -v "$tmp/backups":/out \
  -e PUBLIC_KEY="$public_key" --entrypoint sh testflow-backup:local -c '
    w=$(mktemp -d)
    age -d -i /in/id /in/backup.tar.age | tar -x -C "$w" mongo.archive.gz evidencias_testes
    tar -c -C "$w" mongo.archive.gz evidencias_testes \
      | age -r "$PUBLIC_KEY" -o /out/legacy.tar.age
    rm -rf "$w"
  ' >/dev/null 2>&1
legacy_out=$(restore "$tmp/backups/legacy.tar.age" "$tmp/keys/right.txt" testflow-db-legacy "$tmp/legacy-restored" 2>&1 || true)
legacy_snapshot=$(snapshot testflow-db-legacy)
if printf '%s' "$legacy_out" | grep -q 'legacy archive format' \
  && diff -r "$tmp/evidence" "$tmp/legacy-restored" >/dev/null \
  && [ -n "$legacy_snapshot" ] && [ "$legacy_snapshot" = "$live_before" ]; then pass; else miss; fi
rm -f "$tmp/backups/legacy.tar.age"

label="restore rejects partial metadata archives and unsupported manifest schema versions"
mkdir "$tmp/partial-restored" "$tmp/unsupported-restored"
docker run --rm --user "$(id -u):$(id -g)" \
  -v "$backup":/in/backup.tar.age:ro -v "$tmp/keys/right.txt":/in/id:ro -v "$tmp/backups":/out \
  -e PUBLIC_KEY="$public_key" --entrypoint sh testflow-backup:local -c '
    w=$(mktemp -d)
    age -d -i /in/id /in/backup.tar.age | tar -x -C "$w"
    tar -c -C "$w" manifest.json mongo.archive.gz evidencias_testes \
      | age -r "$PUBLIC_KEY" -o /out/partial.tar.age
    sed "s/\"schemaVersion\": 1/\"schemaVersion\": 99/" "$w/manifest.json" >"$w/manifest.v99"
    mv "$w/manifest.v99" "$w/manifest.json"
    tar -c -C "$w" manifest.json checksums.sha256 permissions.txt mongo.archive.gz evidencias_testes \
      | age -r "$PUBLIC_KEY" -o /out/unsupported.tar.age
    rm -rf "$w"
  ' >/dev/null 2>&1
if restore "$tmp/backups/partial.tar.age" "$tmp/keys/right.txt" testflow-db-partial "$tmp/partial-restored" >/dev/null 2>&1 \
  || restore "$tmp/backups/unsupported.tar.age" "$tmp/keys/right.txt" testflow-db-unsupported "$tmp/unsupported-restored" >/dev/null 2>&1; then miss
elif [ -z "$(ls -A "$tmp/partial-restored")" ] && [ -z "$(snapshot testflow-db-partial)" ] \
  && [ -z "$(ls -A "$tmp/unsupported-restored")" ] && [ -z "$(snapshot testflow-db-unsupported)" ]; then pass; else miss; fi
rm -f "$tmp/backups/partial.tar.age" "$tmp/backups/unsupported.tar.age"

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

echo "rehearsal: backup_ms=${backup_ms} rpo_window_ms=${rpo_window_ms} rto_ms=${rto_ms}"
[ "$fails" -eq 0 ] && echo "backup: all passed" || { echo "backup: $fails failed" >&2; exit 1; }

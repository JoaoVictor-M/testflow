#!/bin/sh
# Verify the published configuration, including the workflow's removal of development docs.
set -eu
cd "$(dirname "$0")/.."
mkdir -p .cache
tmp=$(mktemp -d "$PWD/.cache/testflow-production-config-XXXXXX")
trap 'rm -rf "$tmp"' EXIT
sh scripts/test/format-production.sh "$tmp" >/dev/null 2>&1
cp docker-compose.yml "$tmp/source-compose.yml"
FRONTEND_URL=https://frontend.example.test/testflow NGINX_PUBLIC_ORIGIN= \
  docker compose -f "$tmp/prod/docker-compose.yml" config --format json >"$tmp/config.json"
# The backup service and the restore script reach production together with the Compose file.
[ -f "$tmp/prod/backup/Dockerfile" ] && [ -x "$tmp/prod/scripts/restore.sh" ] \
  || { echo 'production: backup/ and scripts/restore.sh must be published' >&2; exit 1; }
docker compose --env-file /dev/null --profile tools -f "$tmp/prod/docker-compose.yml" config --format json >"$tmp/config-tools.json"
node_image=$(sed -n 's/^NODE_IMAGE=//p' scripts/check.sh)
docker run --rm -i --user "$(id -u):$(id -g)" -v "$tmp:/fixture:ro" "$node_image" node - <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { services } = JSON.parse(fs.readFileSync('/fixture/config.json', 'utf8'));
const init = services['evidence-init'];
const backend = services['backend-service'];
const source = fs.readFileSync('/fixture/source-compose.yml', 'utf8');
assert.equal(services['mongodb-service'].image, source.match(/image: (mongo:[^\s]+)/)[1]);
assert.equal(init.image, backend.image);
assert.equal(init.build, undefined);
assert.equal(backend.build, undefined);
assert.equal(init.user, '0:0');
assert.deepEqual(init.entrypoint, ['chown']);
assert.deepEqual(init.command, ['-Rh', '1000:1000', '/evidencias_testes']);
assert.equal(init.network_mode, 'none');
assert.equal(init.read_only, true);
assert.equal(backend.depends_on['evidence-init'].condition, 'service_completed_successfully');
assert.deepEqual(init.volumes, backend.volumes);
assert.equal(services['nginx-service'].environment.NGINX_PUBLIC_ORIGIN, '');
assert.equal(services['nginx-service'].environment.FRONTEND_URL, 'https://frontend.example.test/testflow');
assert.equal(backend.environment.JWT_SECRET, '');
assert.equal(backend.restart, 'on-failure:3');
const backup = JSON.parse(fs.readFileSync('/fixture/config-tools.json', 'utf8')).services.backup;
assert.ok(backup.build.context.endsWith('/prod/backup'), 'the backup image is built from the published folder');
assert.equal(backup.image, 'testflow-backup:local');
const readme = fs.readFileSync('/fixture/prod/README.md', 'utf8');
assert.match(readme, /NGINX_PUBLIC_ORIGIN/);
assert.match(readme, /FRONTEND_URL/);
assert.match(readme, /JWT_SECRET/);
assert.match(readme, /Rotação/);
assert.match(readme, /sessões/);
assert.match(readme, /root:root/);
assert.match(readme, /640/);
assert.doesNotMatch(readme, /prepare-evidence\.sh/);
assert.doesNotMatch(readme, /## 🛠️ Desenvolvimento/);
assert.doesNotMatch(readme, /\]\(CHANGELOG\.md\)/);
assert.match(readme, /https:\/\/github\.com\/JoaoVictor-M\/testflow\/blob\/main\/CHANGELOG\.md/);
console.log('production: automatic evidence initialization, backup files and TLS migration docs preserved');
NODE

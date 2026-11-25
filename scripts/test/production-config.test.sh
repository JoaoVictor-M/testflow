#!/bin/sh
# Verify the production formatting script produces a valid Compose file, backup/restore files and
# production README in a disposable destination.
set -eu
cd "$(dirname "$0")/../.."
mkdir -p .cache
tmp=$(mktemp -d "$PWD/.cache/testflow-production-config-XXXXXX")
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/prod"
git init -q "$tmp/prod"
REGISTRY=registry.example.test IMAGE_OWNER=testflow-fixture RELEASE_TAG=v0.0.0 \
  sh scripts/ci/format-prod.sh "$PWD" "$tmp/prod" >/dev/null 2>&1

[ -f "$tmp/prod/mongo-init.js" ] && [ -f "$tmp/prod/backup/Dockerfile" ] && [ -x "$tmp/prod/scripts/restore.sh" ] \
  || { echo 'production: mongo-init.js, backup/ and scripts/restore.sh must be published' >&2; exit 1; }
[ ! -f "$tmp/prod/backup/restore.sh" ] \
  || { echo 'production: only scripts/restore.sh should exist' >&2; exit 1; }

FRONTEND_URL=https://frontend.example.test/testflow NGINX_PUBLIC_ORIGIN= JWT_SECRET= \
  docker compose --env-file /dev/null -f "$tmp/prod/docker-compose.yml" config --format json >"$tmp/config.json"
docker compose --env-file /dev/null --profile tools -f "$tmp/prod/docker-compose.yml" config --format json >"$tmp/config-tools.json"

node_image=$(sed -n 's/^NODE_IMAGE=//p' scripts/check.sh)
docker run --rm -i --user "$(id -u):$(id -g)" -v "$tmp:/fixture:ro" "$node_image" node - <<'NODE'
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { services } = JSON.parse(fs.readFileSync('/fixture/config.json', 'utf8'));
assert.equal(services['evidence-init'].image, services['backend-service'].image);
assert.equal(services['backend-service'].build, undefined);
assert.match(services['backend-service'].image, /testflow-backend:v0\.0\.0$/);
assert.match(services['frontend-service'].image, /testflow-frontend:v0\.0\.0$/);
assert.match(services['nginx-service'].image, /testflow-nginx:v0\.0\.0$/);
assert.equal(JSON.parse(fs.readFileSync('/fixture/prod/version.json', 'utf8')).version, 'v0.0.0');
assert.ok(services['mongodb-service'].volumes.some((v) => v.source.endsWith('/prod/mongo-init.js')));
const backup = JSON.parse(fs.readFileSync('/fixture/config-tools.json', 'utf8')).services.backup;
assert.ok(backup.build.context.endsWith('/prod/backup'));
const readme = fs.readFileSync('/fixture/prod/README.md', 'utf8');
assert.doesNotMatch(readme, /## 🛠️ Desenvolvimento/);
console.log('production: formatted compose, mongo-init, backup/restore and README verified');
NODE

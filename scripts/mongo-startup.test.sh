#!/bin/sh
# Real MongoDB startup with the Ubuntu kernel identity used by CI, even on older hosts.
# Uses only disposable tmpfs storage; never starts the application or mounts its data.
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d /tmp/testflow-mongo-startup-XXXXXX)
project="testflow-mongo-startup-$(basename "$tmp" | tr 'A-Z' 'a-z')"
compose() { docker compose --env-file /dev/null -p "$project" -f docker-compose.yml -f "$tmp/compose.yml" "$@"; }
cleanup() {
  compose down --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# The entrypoint drops to the MongoDB UID, which must be able to read this fixture.
chmod 755 "$tmp"
cp scripts/test/ubuntu-kernel.c "$tmp/kernel.c"
printf '%s\n' 'Ubuntu 7.0.0-1019.19-azure 7.0.14' >"$tmp/version_signature"
node_image=$(sed -n 's/^NODE_IMAGE=//p' scripts/check.sh)
docker run --rm --user "$(id -u):$(id -g)" -v "$tmp:/fixture" -w /fixture "$node_image" \
  gcc -Wall -Wextra -Werror -shared -fPIC -o kernel.so kernel.c -ldl
cat >"$tmp/compose.yml" <<EOF
services:
  mongodb-service:
    restart: "no"
    environment:
      LD_PRELOAD: /fixture/kernel.so
    volumes: !override
      - type: tmpfs
        target: /data/db
      - type: tmpfs
        target: /data/configdb
      - $tmp:/fixture:ro
      - ./install/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro
EOF
if ! compose up -d --wait --wait-timeout 90 mongodb-service; then
  compose logs --no-color mongodb-service
  exit 1
fi
# Prove that initialization and ordinary database operations work, beyond the healthcheck ping.
compose exec -T mongodb-service mongosh --quiet --eval '
  const database = db.getSiblingDB("testflow-db");
  if (!database.users.findOne({ username: "admin" })) quit(1);
  database.startup_probe.insertOne({ _id: "probe", value: 42 });
  if (database.startup_probe.findOne({ _id: "probe" }).value !== 42) quit(1);
  database.startup_probe.drop();
'
echo 'mongo-startup: Ubuntu kernel compatibility, initialization and read/write passed'

#!/bin/sh
# Real MongoDB startup with the Ubuntu kernel identity used by CI, even on older hosts.
# Uses only disposable tmpfs storage; never starts the application or mounts its data.
set -eu
cd "$(dirname "$0")/.."
mkdir -p .cache
tmp=$(mktemp -d "$PWD/.cache/testflow-mongo-startup-XXXXXX")
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
start_mongo() {
  if ! compose up -d --wait --wait-timeout 90 mongodb-service; then
    compose logs --no-color mongodb-service
    exit 1
  fi
}
mongo_eval() { compose exec -T mongodb-service mongosh --quiet --eval "$1"; }
stop_mongo() { compose down --remove-orphans >/dev/null 2>&1; }
no_users='if (db.getSiblingDB("testflow-db").users.countDocuments({}) !== 0) quit(1)'

# Without the hash variable the seed creates no account and says the variable is missing.
unset TESTFLOW_ADMIN_PASSWORD_HASH
start_mongo
mongo_eval "$no_users"
if ! compose logs --no-color mongodb-service | grep -q 'TESTFLOW_ADMIN_PASSWORD_HASH não está definida'; then
  echo 'mongo-startup: the seed did not say the hash variable is missing' >&2
  exit 1
fi
stop_mongo

# A value that is not a strong bcrypt hash is refused and reported as invalid: a plain password,
# a cost below 10 and a character outside the bcrypt alphabet.
body=$(printf 'x%.0s' $(seq 53))
for invalid in plaintext-password "\$2b\$04\$$body" "\$2b\$10\$${body%x}!"; do
  export TESTFLOW_ADMIN_PASSWORD_HASH="$invalid"
  start_mongo
  mongo_eval "$no_users"
  if ! compose logs --no-color mongodb-service | grep -q 'não é um hash bcrypt válido'; then
    echo 'mongo-startup: the seed did not report the invalid hash' >&2
    exit 1
  fi
  stop_mongo
done

# With a bcrypt hash the admin is created with exactly that hash.
bcrypt_hash="\$2b\$10\$$body"
export TESTFLOW_ADMIN_PASSWORD_HASH="$bcrypt_hash"
start_mongo
# Prove that initialization and ordinary database operations work, beyond the healthcheck ping.
mongo_eval '
  const database = db.getSiblingDB("testflow-db");
  const admin = database.users.findOne({ username: "admin" });
  if (!admin || admin.role !== "admin" || admin.password !== "'"$bcrypt_hash"'") quit(1);
  database.startup_probe.insertOne({ _id: "probe", value: 42 });
  if (database.startup_probe.findOne({ _id: "probe" }).value !== 42) quit(1);
  database.startup_probe.drop();
'
echo 'mongo-startup: Ubuntu kernel compatibility, seed with and without the admin hash, read/write passed'

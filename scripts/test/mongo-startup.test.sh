#!/bin/sh
# Real MongoDB startup and first-administrator seed behavior on disposable tmpfs storage.
# Never starts the application or mounts persistent data.
set -eu
cd "$(dirname "$0")/../.."
mkdir -p .cache
tmp=$(mktemp -d "$PWD/.cache/testflow-mongo-startup-XXXXXX")
project="testflow-mongo-startup-$(basename "$tmp" | tr 'A-Z' 'a-z')"
compose() { docker compose --env-file /dev/null -p "$project" -f docker-compose.yml -f docker-compose.teste.yml "$@"; }
cleanup() {
  compose down --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

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

# A value that is not a strong bcrypt hash is refused and reported as invalid.
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
mongo_eval '
  const database = db.getSiblingDB("testflow-db");
  const admin = database.users.findOne({ username: "admin" });
  if (!admin || admin.role !== "admin" || admin.password !== "'"$bcrypt_hash"'") quit(1);
  database.startup_probe.insertOne({ _id: "probe", value: 42 });
  if (database.startup_probe.findOne({ _id: "probe" }).value !== 42) quit(1);
  database.startup_probe.drop();
'
echo 'mongo-startup: seed with and without the admin hash, read/write passed'

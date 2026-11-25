#!/bin/sh
# Disposable Compose stack: never reuses the running application's containers or data.
set -eu
cd "$(dirname "$0")/../.."
root=$PWD
node_image=$(sed -n 's/^NODE_IMAGE=//p' scripts/check.sh)
mkdir -p "$root/.cache"
tmp=$(mktemp -d "$root/.cache/testflow-images-XXXXXX")
chmod 755 "$tmp"
export BUILDX_CONFIG="$tmp/buildx"
export COMPOSE_PROJECT_NAME="testflow-images-$(basename "$tmp" | tr '[:upper:]' '[:lower:]')"
export COMPOSE_FILE="$root/docker-compose.yml:$tmp/compose.yml"
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then docker compose logs --tail 30 >&2 || true; fi
  docker compose down --remove-orphans >/dev/null 2>&1 || true
  # Legacy fixtures use UID 1000 and restrictive modes, regardless of the host's UID.
  docker run --rm -e TESTFLOW_FIXTURE_UID="$(id -u)" -e TESTFLOW_FIXTURE_GID="$(id -g)" \
    -v "$tmp:/fixtures" "$node_image" sh -ec \
    'chown -Rh "$TESTFLOW_FIXTURE_UID:$TESTFLOW_FIXTURE_GID" /fixtures'
  rm -rf "$tmp"
  echo 'ok - isolated fixtures cleaned with host ownership restored'
}
trap cleanup EXIT
mkdir "$tmp/certificates" "$tmp/evidence"
cat >"$tmp/compose.yml" <<EOF
services:
  evidence-init:
    volumes: !override
      - $tmp/evidence:/evidencias_testes
  mongodb-service:
    container_name: ${COMPOSE_PROJECT_NAME}-mongo
    volumes: !reset []
    tmpfs:
      - /data/db
      - /data/configdb
  backend-service:
    container_name: ${COMPOSE_PROJECT_NAME}-backend
    command: ["node", "server.js"]
    environment:
      MONGO_URI: mongodb://mongodb-service:27017/testflow-images-smoke
      NODE_EXTRA_CA_CERTS: /fixtures/certificates/testflow.crt
    volumes: !override
      - $tmp/evidence:/evidencias_testes
      - $tmp:/fixtures:ro
      - $root/scripts/test/images-smoke.cjs:/app/images-smoke.cjs:ro
  frontend-service:
    container_name: ${COMPOSE_PROJECT_NAME}-frontend
  nginx-service:
    container_name: ${COMPOSE_PROJECT_NAME}-nginx
    ports: !reset []
    environment:
      NGINX_PUBLIC_ORIGIN: ""
      FRONTEND_URL: https://canonical.example.test/testflow
    volumes: !override
      - $tmp/certificates:/etc/nginx/ssl:ro
EOF
# OpenSSL and Node run inside the same pinned tool image used by the quality gate.
docker run --rm -e TESTFLOW_FIXTURE_UID="$(id -u)" -e TESTFLOW_FIXTURE_GID="$(id -g)" \
  -v "$tmp:/fixtures" "$node_image" sh -ec '
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
    -keyout /fixtures/certificates/testflow.key -out /fixtures/certificates/testflow.crt \
    -subj /CN=nginx-service -addext subjectAltName=DNS:nginx-service,DNS:localhost 2>/dev/null
  chown 0:101 /fixtures/certificates/testflow.key
  chmod 640 /fixtures/certificates/testflow.key
  node -e '\''require("fs").writeFileSync("/fixtures/backend.env", "JWT_SECRET=" + require("crypto").randomBytes(32).toString("hex") + "\n", {mode: 0o600})'\''
  chown "$TESTFLOW_FIXTURE_UID:$TESTFLOW_FIXTURE_GID" /fixtures/backend.env
  mkdir /fixtures/foreign-owned
  touch /fixtures/foreign-owned/keep
  chmod 700 /fixtures/foreign-owned
  chown -R 2001:2001 /fixtures/foreign-owned
'
# Supply a fresh secret without printing it or embedding it in tracked configuration.
cat >"$tmp/secret.yml" <<EOF
services:
  backend-service:
    env_file: $tmp/backend.env
    environment: !override
      MONGO_URI: mongodb://mongodb-service:27017/testflow-images-smoke
      NODE_EXTRA_CA_CERTS: /fixtures/certificates/testflow.crt
      FRONTEND_URL: https://localhost/testflow
      TRUST_PROXY_HOPS: "1"
EOF
export COMPOSE_FILE="$COMPOSE_FILE:$tmp/secret.yml"
docker compose build
docker compose run --rm --no-deps --user 0:0 --entrypoint chown backend-service 0:0 /evidencias_testes
# Exercise dev.sh's real --wait path without touching this checkout's .env or git config.
mkdir -p "$tmp/dev/scripts"
cp scripts/dev.sh "$tmp/dev/scripts/dev.sh"
cp .env.example "$tmp/dev/.env.example"
git init -q "$tmp/dev"
sh "$tmp/dev/scripts/dev.sh" up
for service in backend-service frontend-service nginx-service; do
  uid=$(docker compose exec -T "$service" id -u)
  [ "$uid" -ne 0 ] || { echo "$service is running as root" >&2; exit 1; }
done
docker compose exec -T backend-service node images-smoke.cjs fresh

# Re-run the actual published Compose against existing root-owned storage.
docker compose down --remove-orphans
mkdir -p "$tmp/deploy/prod"
git init -q "$tmp/deploy/prod"
REGISTRY=registry.example.test IMAGE_OWNER="$COMPOSE_PROJECT_NAME" RELEASE_TAG=latest \
  sh scripts/ci/format-prod.sh "$root" "$tmp/deploy/prod"
for component in backend frontend nginx; do
  docker image tag "${COMPOSE_PROJECT_NAME}-${component}-service" \
    "registry.example.test/${COMPOSE_PROJECT_NAME}/testflow-${component}:latest"
done
cat >"$tmp/pull.yml" <<EOF
services:
  evidence-init:
    pull_policy: never
  backend-service:
    pull_policy: never
  frontend-service:
    pull_policy: never
  nginx-service:
    pull_policy: never
EOF
export COMPOSE_FILE="$tmp/deploy/prod/docker-compose.yml:$tmp/compose.yml:$tmp/secret.yml:$tmp/pull.yml"
docker compose run --rm --no-deps --user 0:0 --entrypoint sh backend-service -ec '
  mkdir -p /evidencias_testes/legacy
  printf "existing evidence\n" > /evidencias_testes/legacy/keep.txt
  chmod 700 /evidencias_testes/legacy
  chmod 600 /evidencias_testes/legacy/keep.txt
  chown -Rh 0:0 /evidencias_testes
'
docker compose up -d --wait
docker compose exec -T backend-service node images-smoke.cjs
echo 'ok - production Compose automatically migrates legacy storage'

# The very same proxy image must start without certificates and serve HTTP.
mkdir "$tmp/no-certificates"
docker run --rm --network "${COMPOSE_PROJECT_NAME}_default" \
  -v "$tmp/no-certificates:/etc/nginx/ssl:ro" \
  --entrypoint sh "${COMPOSE_PROJECT_NAME}-nginx-service" -ec '
    /etc/nginx/entrypoint.sh &
    nginx_pid=$!
    trap "kill $nginx_pid; wait $nginx_pid || true" EXIT
    for attempt in 1 2 3 4 5; do
      if wget -q -O /tmp/index http://127.0.0.1:8080/testflow/; then
        grep -q "<html" /tmp/index
        echo "ok - HTTP fallback without certificates"
        exit 0
      fi
      sleep 1
    done
    exit 1
  '
# Deployment settings cannot inject nginx configuration.
if docker run --rm -e 'NGINX_PUBLIC_ORIGIN=https://safe.test;return 200;' \
  "${COMPOSE_PROJECT_NAME}-nginx-service"; then
  echo 'invalid public origin was accepted' >&2
  exit 1
fi

# Existing root-only TLS files must report the required migration before nginx starts.
docker run --rm -v "$tmp/certificates:/certificates" "$node_image" sh -ec '
  cp /certificates/testflow.key /certificates/unreadable.key
  chown 0:0 /certificates/unreadable.key
  chmod 600 /certificates/unreadable.key
'
if docker run --rm -v "$tmp/certificates/testflow.crt:/etc/nginx/ssl/testflow.crt:ro" \
  -v "$tmp/certificates/unreadable.key:/etc/nginx/ssl/testflow.key:ro" \
  "${COMPOSE_PROJECT_NAME}-nginx-service" >"$tmp/tls-error" 2>&1; then
  echo 'root-only TLS key was accepted' >&2
  exit 1
fi
grep -q 'TLS certificate and private key must be readable by nginx' "$tmp/tls-error"
if docker run --rm -v "$tmp/certificates/unreadable.key:/etc/nginx/ssl/testflow.crt:ro" \
  -v "$tmp/certificates/testflow.key:/etc/nginx/ssl/testflow.key:ro" \
  "${COMPOSE_PROJECT_NAME}-nginx-service" >"$tmp/tls-error" 2>&1; then
  echo 'root-only TLS certificate was accepted' >&2
  exit 1
fi
grep -q 'TLS certificate and private key must be readable by nginx' "$tmp/tls-error"
echo 'ok - unreadable legacy TLS certificate/key fail with a migration diagnostic'

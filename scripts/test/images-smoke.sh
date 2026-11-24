#!/bin/sh
# Disposable Compose stack: never reuses the running application's containers or data.
set -eu
cd "$(dirname "$0")/../.."
root=$PWD
tmp=$(mktemp -d /tmp/testflow-images-XXXXXX)
chmod 755 "$tmp"
export BUILDX_CONFIG="$tmp/buildx"
export COMPOSE_PROJECT_NAME="testflow-images-$(basename "$tmp" | tr '[:upper:]' '[:lower:]')"
export COMPOSE_FILE="$root/docker-compose.yml:$tmp/compose.yml"
cleanup() {
  result=$?
  if [ "$result" -ne 0 ]; then docker compose logs --tail 30 >&2 || true; fi
  docker compose down --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
mkdir "$tmp/certificates" "$tmp/evidence"
cat >"$tmp/compose.yml" <<EOF
services:
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
      NGINX_PUBLIC_ORIGIN: https://canonical.example.test
    volumes: !override
      - $tmp/certificates:/etc/nginx/ssl:ro
EOF
# OpenSSL and Node run inside the same pinned tool image used by the quality gate.
node_image=$(sed -n 's/^NODE_IMAGE=//p' scripts/check.sh)
docker run --rm -e TESTFLOW_FIXTURE_UID="$(id -u)" -e TESTFLOW_FIXTURE_GID="$(id -g)" \
  -v "$tmp:/fixtures" "$node_image" sh -ec '
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
    -keyout /fixtures/certificates/testflow.key -out /fixtures/certificates/testflow.crt \
    -subj /CN=nginx-service -addext subjectAltName=DNS:nginx-service,DNS:localhost 2>/dev/null
  chown 101:101 /fixtures/certificates/testflow.key
  chmod 640 /fixtures/certificates/testflow.key
  node -e '\''require("fs").writeFileSync("/fixtures/backend.env", "JWT_SECRET=" + require("crypto").randomBytes(32).toString("hex") + "\n", {mode: 0o600})'\''
  chown "$TESTFLOW_FIXTURE_UID:$TESTFLOW_FIXTURE_GID" /fixtures/backend.env
'
# Supply a fresh secret without printing it or embedding it in tracked configuration.
cat >"$tmp/secret.yml" <<EOF
services:
  backend-service:
    env_file: $tmp/backend.env
EOF
export COMPOSE_FILE="$COMPOSE_FILE:$tmp/secret.yml"
docker compose build
docker compose run --rm --no-deps --user 0:0 --entrypoint sh backend-service -ec '
  mkdir -p /evidencias_testes/legacy
  printf "existing evidence\n" > /evidencias_testes/legacy/keep.txt
  chmod 700 /evidencias_testes/legacy
  chmod 600 /evidencias_testes/legacy/keep.txt
'
sh scripts/prepare-evidence.sh
sh scripts/prepare-evidence.sh
docker compose up -d --build
for service in backend-service frontend-service nginx-service; do
  uid=$(docker compose exec -T "$service" id -u)
  [ "$uid" -ne 0 ] || { echo "$service is running as root" >&2; exit 1; }
done
docker compose exec -T backend-service node images-smoke.cjs

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

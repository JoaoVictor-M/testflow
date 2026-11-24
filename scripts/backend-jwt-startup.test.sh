#!/bin/sh
# Verifies in Compose that backend-service keeps restart: always, exits with code 1 when
# JWT_SECRET is missing or too short, never becomes healthy and never prints the secret in logs.
set -eu
cd "$(dirname "$0")/.."
mkdir -p .cache
tmp=$(mktemp -d "$PWD/.cache/testflow-backend-jwt-startup-XXXXXX")
project="testflow-jwt-startup-$(basename "$tmp" | tr 'A-Z' 'a-z')"
compose() { docker compose --env-file /dev/null -p "$project" -f docker-compose.yml -f "$tmp/compose.yml" "$@"; }
cleanup() {
  compose down --remove-orphans --rmi local >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Keep restart policy and JWT_SECRET forwarding untouched from docker-compose.yml; isolate storage.
cat >"$tmp/compose.yml" <<'EOF'
services:
  backend-service:
    volumes: !override
      - type: tmpfs
        target: /evidencias_testes
EOF

compose build backend-service >/dev/null

assert_fails_without_healthy_or_leak() {
  label=$1
  forbidden=$2

  compose up -d --no-deps backend-service >/dev/null 2>&1
  container_id=$(compose ps -aq backend-service)
  [ -n "$container_id" ] || { echo "backend-jwt-startup ($label): container not created" >&2; exit 1; }

  policy=$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container_id")
  if [ "$policy" != "always" ]; then
    echo "backend-jwt-startup ($label): expected restart policy always, got $policy" >&2
    exit 1
  fi

  failed=0
  for _ in $(seq 1 15); do
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")
    if [ "$health" = "healthy" ]; then
      echo "backend-jwt-startup ($label): container unexpectedly became healthy" >&2
      exit 1
    fi
    exit_code=$(docker inspect --format '{{.State.ExitCode}}' "$container_id")
    restarts=$(docker inspect --format '{{.RestartCount}}' "$container_id")
    status=$(docker inspect --format '{{.State.Status}}' "$container_id")
    if [ "$exit_code" = "1" ] && { [ "$restarts" -ge 1 ] || [ "$status" = "restarting" ] || [ "$status" = "exited" ]; }; then
      failed=1
      break
    fi
    sleep 1
  done

  if [ "$failed" -ne 1 ]; then
    echo "backend-jwt-startup ($label): expected exit code 1 failure; status=$status exit=$exit_code restarts=$restarts health=$health" >&2
    compose logs --no-color backend-service >&2 || true
    exit 1
  fi

  health_after=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")
  if [ "$health_after" = "healthy" ]; then
    echo "backend-jwt-startup ($label): container became healthy after failing" >&2
    exit 1
  fi

  logs=$(compose logs --no-color backend-service 2>&1)
  printf '%s\n' "$logs" | grep -q '"code":"JWT_CONFIG_INVALID"' || {
    echo "backend-jwt-startup ($label): missing structured JWT_CONFIG_INVALID log" >&2
    exit 1
  }
  if [ -n "$forbidden" ] && printf '%s\n' "$logs" | grep -qF "$forbidden"; then
    echo "backend-jwt-startup ($label): invalid JWT_SECRET leaked into logs" >&2
    exit 1
  fi

  compose down --remove-orphans >/dev/null 2>&1
}

unset JWT_SECRET
assert_fails_without_healthy_or_leak "missing secret" ""

short_probe="curto-$(od -An -tx1 -N6 /dev/urandom | tr -d ' \n')"
export JWT_SECRET="$short_probe"
assert_fails_without_healthy_or_leak "short secret" "$short_probe"
unset JWT_SECRET

echo "backend-jwt-startup: missing and short JWT_SECRET exit 1, never become healthy, leak nothing and keep restart: always"

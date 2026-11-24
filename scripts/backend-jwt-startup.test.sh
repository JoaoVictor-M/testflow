#!/bin/sh
# Verifies in Compose that backend-service stops instead of looping forever when JWT_SECRET is
# missing or too short, and never prints the provided invalid secret in container logs.
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

assert_stops_without_loop() {
  label=$1
  forbidden=$2

  compose up -d --no-deps backend-service >/dev/null 2>&1
  container_id=$(compose ps -aq backend-service)
  [ -n "$container_id" ] || { echo "backend-jwt-startup ($label): container not created" >&2; exit 1; }

  stopped=0
  for _ in $(seq 1 15); do
    state=$(docker inspect --format '{{.State.Status}} {{.State.Running}} {{.State.Restarting}} {{.State.ExitCode}} {{.RestartCount}}' "$container_id")
    case "$state" in
      "exited false false 1 "*)
        stopped=1
        break
        ;;
    esac
    sleep 1
  done

  if [ "$stopped" -ne 1 ]; then
    echo "backend-jwt-startup ($label): container did not stop cleanly; state=$state" >&2
    compose logs --no-color backend-service >&2 || true
    exit 1
  fi

  restarts_before=$(docker inspect --format '{{.RestartCount}}' "$container_id")
  sleep 2
  state_after=$(docker inspect --format '{{.State.Status}} {{.State.Running}} {{.State.Restarting}} {{.State.ExitCode}} {{.RestartCount}}' "$container_id")
  restarts_after=$(docker inspect --format '{{.RestartCount}}' "$container_id")
  policy=$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}:{{.HostConfig.RestartPolicy.MaximumRetryCount}}' "$container_id")

  if [ "$policy" != "on-failure:3" ] || [ "$restarts_after" != "$restarts_before" ] || [ "$restarts_after" -gt 3 ]; then
    echo "backend-jwt-startup ($label): unexpected restart behavior policy=$policy before=$restarts_before after=$restarts_after state=$state_after" >&2
    exit 1
  fi

  case "$state_after" in
    "exited false false 1 "*) ;;
    *)
      echo "backend-jwt-startup ($label): container restarted after stopping; state=$state_after" >&2
      exit 1
      ;;
  esac

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
assert_stops_without_loop "missing secret" ""

short_probe="curto-$(od -An -tx1 -N6 /dev/urandom | tr -d ' \n')"
export JWT_SECRET="$short_probe"
assert_stops_without_loop "short secret" "$short_probe"
unset JWT_SECRET

echo "backend-jwt-startup: missing and short JWT_SECRET stop cleanly without restart loop"

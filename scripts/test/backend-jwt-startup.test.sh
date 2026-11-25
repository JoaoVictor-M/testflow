#!/bin/sh
# Verifies in Compose that backend-service keeps restart: always, exits with code 1 when
# JWT_SECRET is missing or too short, never becomes healthy and never prints the secret in logs.
set -eu
cd "$(dirname "$0")/../.."
mkdir -p .cache
tmp=$(mktemp -d "$PWD/.cache/testflow-backend-jwt-startup-XXXXXX")
project="testflow-jwt-startup-$(basename "$tmp" | tr 'A-Z' 'a-z')"
compose() { docker compose --env-file /dev/null -p "$project" -f docker-compose.yml -f "$tmp/compose.yml" "$@"; }
events_pid=""
stop_events() {
  if [ -n "$events_pid" ]; then
    kill "$events_pid" >/dev/null 2>&1 || true
    wait "$events_pid" >/dev/null 2>&1 || true
    events_pid=""
  fi
}
cleanup() {
  stop_events
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
  events_file="$tmp/events-$(printf '%s' "$label" | tr ' ' '-').log"

  : >"$events_file"
  since_ts=$(date -u +%s)
  docker events \
    --since "$since_ts" \
    --filter type=container \
    --filter "label=com.docker.compose.project=$project" \
    --filter "label=com.docker.compose.service=backend-service" \
    --filter event=die \
    --filter event=health_status \
    --format '{{.Actor.ID}}|{{.Action}}|{{index .Actor.Attributes "exitCode"}}' \
    >"$events_file" 2>&1 &
  events_pid=$!

  compose up -d --no-deps backend-service >/dev/null 2>&1
  short_id=$(compose ps -aq backend-service)
  [ -n "$short_id" ] || { echo "backend-jwt-startup ($label): container not created" >&2; exit 1; }
  container_id=$(docker inspect --format '{{.Id}}' "$short_id")

  policy=$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$container_id")
  if [ "$policy" != "always" ]; then
    echo "backend-jwt-startup ($label): expected restart policy always, got $policy" >&2
    exit 1
  fi

  observed=0
  for _ in $(seq 1 15); do
    restarts=$(docker inspect --format '{{.RestartCount}}' "$container_id")
    die_count=$(grep -c "^${container_id}|die|" "$events_file" || true)
    if [ "$restarts" -ge 2 ] && [ "$die_count" -ge 2 ]; then
      observed=1
      break
    fi
    sleep 1
  done

  stop_events
  compose stop -t 2 backend-service >/dev/null 2>&1

  if [ "$observed" -ne 1 ]; then
    echo "backend-jwt-startup ($label): expected at least 2 restarts; restarts=$restarts die_events=$die_count" >&2
    cat "$events_file" >&2 || true
    compose logs --no-color backend-service >&2 || true
    exit 1
  fi

  die_seen=0
  while IFS='|' read -r ev_id ev_action ev_exit; do
    [ "$ev_id" = "$container_id" ] || continue
    case $ev_action in
      die)
        die_seen=$((die_seen + 1))
        if [ "$ev_exit" != "1" ]; then
          echo "backend-jwt-startup ($label): expected die exitCode 1, got $ev_exit" >&2
          cat "$events_file" >&2
          exit 1
        fi
        ;;
      health_status*)
        case $ev_action in
          *unhealthy*) ;;
          *healthy*)
            echo "backend-jwt-startup ($label): container emitted healthy event ($ev_action)" >&2
            cat "$events_file" >&2
            exit 1
            ;;
        esac
        ;;
    esac
  done <"$events_file"

  if [ "$die_seen" -lt 2 ]; then
    echo "backend-jwt-startup ($label): expected at least 2 die events, got $die_seen" >&2
    cat "$events_file" >&2
    exit 1
  fi

  health_final=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id")
  if [ "$health_final" = "healthy" ]; then
    echo "backend-jwt-startup ($label): container ended in healthy state" >&2
    exit 1
  fi

  logs=$(compose logs --no-color backend-service 2>&1)
  invalid_count=$(printf '%s\n' "$logs" | grep -c '"code":"JWT_CONFIG_INVALID"' || true)
  if [ "$invalid_count" -lt 2 ]; then
    echo "backend-jwt-startup ($label): expected at least 2 structured JWT_CONFIG_INVALID log entries, got $invalid_count" >&2
    printf '%s\n' "$logs" >&2
    exit 1
  fi
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

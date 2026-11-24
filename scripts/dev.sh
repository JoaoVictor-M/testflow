#!/bin/sh
# The development environment in one command (hot reload; API on :3000, front on :5173). Also turns on
# the git hooks, so a fresh clone is ready after this. It has its own project, so it never touches the
# production stack's containers or its MongoDB volume.
# Usage: scripts/dev.sh [up|down|logs]
set -eu
cd "$(dirname "$0")/.."

export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-testflow-dev}
# A caller's COMPOSE_FILE (the images smoke test layers its own overrides) wins.
export COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.yml:docker-compose.dev.yml}

case ${1:-up} in
  up)
    [ -f .env ] || { cp .env.example .env && echo 'dev.sh: created .env from .env.example'; }
    git config core.hooksPath scripts/git-hooks
    docker compose up -d --build --wait --remove-orphans --renew-anon-volumes ;;
  down) docker compose down --remove-orphans ;;
  logs) docker compose logs -f ;;
  *) echo 'usage: scripts/dev.sh [up|down|logs]' >&2; exit 2 ;;
esac

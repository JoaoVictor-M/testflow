#!/bin/sh
# The development environment in one command. Also turns on the git hooks, so a fresh clone is ready
# after this.
# Usage: scripts/dev.sh [up|down|logs]
set -eu
cd "$(dirname "$0")/.."

[ -f .env ] || { cp .env.example .env && echo 'dev.sh: created .env from .env.example'; }
git config core.hooksPath scripts/git-hooks

export COMPOSE_PROJECT_NAME='testflow'

case ${1:-up} in
  up) docker compose up -d --build --wait --remove-orphans ;;
  down) docker compose down --remove-orphans ;;
  logs) docker compose logs -f ;;
  *) echo 'usage: scripts/dev.sh [up|down|logs]' >&2; exit 2 ;;
esac

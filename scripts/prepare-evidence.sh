#!/bin/sh
# One-time preparation of the existing bind mount when adopting the non-root backend.
# Only ownership changes; files and the mount itself are preserved.
set -eu
cd "$(dirname "$0")/.."
docker compose run --rm --no-deps --build --user 0:0 --entrypoint chown \
  backend-service -Rh node:node /evidencias_testes

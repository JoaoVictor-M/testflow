#!/bin/sh
# End-to-end tests: Playwright in its own container, against the production frontend and nginx of a
# disposable stack, over an isolated network.
set -eu
cd "$(dirname "$0")/.."
. scripts/lib/ci-stack.sh
PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.65.0-noble@sha256:9beb546099e11f52d62e505537914870e01a67e0e6b00ae41da4775324e73dbe
export TESTFLOW_CI_OVERLAY=docker-compose.e2e.yml
rm -rf reports/e2e
open_ci_stack
# The image carries the browsers; npm only installs the test runner, without install scripts.
docker run --rm --init --shm-size=1g --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI \
  -e npm_config_cache=/work/.cache/npm --env-file "$ci_directory/e2e.env" \
  --network "${TESTFLOW_CI_PROJECT}_default" -v "$PWD":/work -w /work/e2e "$PLAYWRIGHT_IMAGE" \
  sh -c 'npm ci --ignore-scripts --no-audit --no-fund && npx playwright test'

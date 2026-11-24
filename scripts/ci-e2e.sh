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
output="$ci_directory/e2e.out"
status=0
docker run --rm --init --shm-size=1g --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI \
  -e npm_config_cache=/work/.cache/npm --env-file "$ci_directory/e2e.env" \
  --network "${TESTFLOW_CI_PROJECT}_default" -v "$PWD":/work -w /work/e2e "$PLAYWRIGHT_IMAGE" \
  sh -c 'npm ci --ignore-scripts --no-audit --no-fund && npx playwright test' > "$output" 2>&1 || status=$?
cat "$output"
# The report is published as an artifact and the output goes to the CI log: neither may carry the
# administrator's generated password.
password=$(sed -n 's/^TESTFLOW_E2E_PASSWORD=//p' "$ci_directory/e2e.env")
if grep -rqF -- "$password" reports/e2e "$output"; then
  echo 'ci-e2e: the generated password appears in the e2e report or output' >&2
  exit 1
fi
exit "$status"

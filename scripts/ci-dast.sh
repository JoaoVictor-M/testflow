#!/bin/sh
# Preserve the full ZAP gate in a disposable, isolated Compose project.
set -eu
cd "$(dirname "$0")/.."
. scripts/lib/ci-stack.sh
ZAP_IMAGE=ghcr.io/zaproxy/zaproxy:stable@sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af
mkdir -p .cache reports/zap
ci_directory=$(mktemp -d "$PWD/.cache/testflow-ci.XXXXXX")
export TESTFLOW_CI_ENV="$ci_directory/backend.env"
export TESTFLOW_CI_PROJECT="testflow-ci-$(basename "$ci_directory" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n_-' '-')"
cleanup() {
  result=$?
  trap - EXIT INT TERM
  ci_compose down --remove-orphans || result=1
  rm -rf "$ci_directory"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
prepare_ci_stack
start_ci_stack
# Runners may use a UID absent from the image's passwd file. Keep Java and Python in a writable home
# and start in the report folder: the scan script writes its log to the working directory.
docker run --rm --init --name "${TESTFLOW_CI_PROJECT}-zap" --user "$(id -u):$(id -g)" -w /zap/wrk \
  -e HOME=/tmp -e USER=zap -e JAVA_TOOL_OPTIONS=-Duser.home=/tmp \
  --network "${TESTFLOW_CI_PROJECT}_default" \
  -v "$PWD/reports/zap:/zap/wrk:rw" "$ZAP_IMAGE" \
  zap-full-scan.py -t http://backend-service:3000 -r report_html.html

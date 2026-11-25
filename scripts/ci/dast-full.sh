#!/bin/sh
# Preserve the full ZAP gate in a disposable, isolated Compose project.
set -eu
cd "$(dirname "$0")/../.."
. scripts/ci/stack.sh
ZAP_IMAGE=ghcr.io/zaproxy/zaproxy:stable@sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af
export FRONTEND_URL=http://backend-service:3000
TESTFLOW_CI_SERVICES='mongodb-service backend-service'
mkdir -p reports/zap
open_ci_stack
# Runners may use a UID absent from the image's passwd file. Keep Java and Python in a writable home
# and start in the report folder: the scan script writes its log to the working directory.
docker run --rm --init --name "${TESTFLOW_CI_PROJECT}-zap" --user "$(id -u):$(id -g)" -w /zap/wrk \
  -e HOME=/tmp -e USER=zap -e JAVA_TOOL_OPTIONS=-Duser.home=/tmp \
  --network "${TESTFLOW_CI_PROJECT}_default" \
  -v "$PWD/reports/zap:/zap/wrk:rw" "$ZAP_IMAGE" \
  zap-full-scan.py -t http://backend-service:3000 -r report_html.html

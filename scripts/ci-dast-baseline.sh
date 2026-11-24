#!/bin/sh
# ZAP baseline (spider and passive rules, no attack) against the production frontend and nginx of a
# disposable stack. The plan in .zap/baseline.yaml fails the run on any Medium or higher alert.
set -eu
cd "$(dirname "$0")/.."
. scripts/lib/ci-stack.sh
ZAP_IMAGE=ghcr.io/zaproxy/zaproxy:stable@sha256:9624669db72f54d86c4b46a7064518bd9bf79d8c61a4c31befa9923489f328af
export TESTFLOW_CI_OVERLAY=docker-compose.e2e.yml
rm -rf reports/zap-baseline
mkdir -p reports/zap-baseline
open_ci_stack
# Same writable-home setup as the full scan; the plan is read-only and the reports land in /zap/wrk.
docker run --rm --init --name "${TESTFLOW_CI_PROJECT}-zap" --user "$(id -u):$(id -g)" -w /zap/wrk \
  -e HOME=/tmp -e USER=zap -e JAVA_TOOL_OPTIONS=-Duser.home=/tmp \
  --network "${TESTFLOW_CI_PROJECT}_default" \
  -v "$PWD/.zap:/zap/plan:ro" -v "$PWD/reports/zap-baseline:/zap/wrk:rw" "$ZAP_IMAGE" \
  zap.sh -cmd -autorun /zap/plan/baseline.yaml

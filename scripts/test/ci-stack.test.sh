#!/bin/sh
# Exercise the CI stack runners (dast-full, e2e, dast-baseline) with a fake Docker:
# services started, credentials handling, failure propagation and cleanup.
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/repo/scripts/ci" "$tmp/bin"
for script in stack.sh dast-full.sh e2e.sh dast-baseline.sh; do
  cp "$root/scripts/ci/$script" "$tmp/repo/scripts/ci/$script"
done

cat > "$tmp/bin/docker" <<'EOF'
#!/bin/sh
echo "$*" >> "$TESTFLOW_DOCKER_LOG"
printf '%s\n' "${TESTFLOW_CI_PROJECT:-}" > "$TESTFLOW_PROJECT_LOG"
case "$*" in *'up -d'*'nginx-service'*) [ -f "$TESTFLOW_CI_TLS/testflow.crt" ] && [ -f "$TESTFLOW_CI_TLS/testflow.key" ] || exit 1 ;; esac
previous=
for argument in "$@"; do
  if [ "$previous" = --env-file ] && [ "$argument" != /dev/null ]; then cp "$argument" "$TESTFLOW_ENV_COPY"; fi
  previous=$argument
done
case "$*" in *playwright*)
  password=$(sed -n 's/^TESTFLOW_E2E_PASSWORD=//p' "$TESTFLOW_ENV_COPY")
  case "${TESTFLOW_LEAK:-}" in
    report) mkdir -p reports/e2e && echo "$password" > reports/e2e/relatorio.txt ;;
    output) echo "$password" ;;
  esac ;;
esac
case "$*" in *'run --rm --no-deps -T backend-service'*) cat > /dev/null; echo '$2b$10$fixture' ;; esac
case "$TESTFLOW_FAIL_ON:$*" in 'logs mongodb-service:'*'up -d'*) exit 1 ;; esac
case "$*" in *"$TESTFLOW_FAIL_ON"*) exit 1 ;; esac
EOF
chmod +x "$tmp/bin/docker"
printf '#!/bin/sh\nprintf "1001\\n"\n' > "$tmp/bin/id"
chmod +x "$tmp/bin/id"

run_target() {
  : > "$tmp/docker.log"
  rm -f "$tmp/env.copy"
  PATH="$tmp/bin:$PATH" TESTFLOW_DOCKER_LOG="$tmp/docker.log" TESTFLOW_PROJECT_LOG="$tmp/project" \
    TESTFLOW_ENV_COPY="$tmp/env.copy" TESTFLOW_FAIL_ON="$2" sh "$tmp/repo/scripts/ci/$1" > "$tmp/output" 2>&1
}
cleaned() { grep -q 'down --remove-orphans' "$tmp/docker.log" && [ -z "$(ls -A "$tmp/repo/.cache")" ]; }

# dast-full starts only mongodb-service and backend-service on the shared compose layers.
run_target dast-full.sh @never@
first_project=$(cat "$tmp/project")
grep -q -- '-f docker-compose.yml -f docker-compose.teste.yml up -d --build --wait --wait-timeout 180 mongodb-service backend-service' "$tmp/docker.log"
grep -q -- '--user 1001:1001 -w /zap/wrk -e HOME=/tmp -e USER=zap -e JAVA_TOOL_OPTIONS=-Duser.home=/tmp' "$tmp/docker.log"
grep -q 'zap-full-scan.py -t http://backend-service:3000 -r report_html.html' "$tmp/docker.log"
cleaned
echo 'ok - dast-full runs on isolated production+test layers and cleans up'

run_target dast-full.sh @never@
[ "$first_project" != "$(cat "$tmp/project")" ]
echo 'ok - concurrent runs never share a Compose project'

for failure in 'up -d' zap-full-scan.py 'logs mongodb-service' 'down --remove-orphans'; do
  if run_target dast-full.sh "$failure"; then echo "FAIL - dast-full accepted failure: $failure" >&2; exit 1; fi
  cleaned
  [ "$failure" != 'up -d' ] || ! grep -q 'zap-full-scan.py' "$tmp/docker.log"
done
echo 'ok - dast-full propagates every failure and removes temporary secrets'

# e2e starts the full browser stack with seeded admin and redacts/refuses credential leaks.
run_target e2e.sh @never@
grep -q -- '-f docker-compose.yml -f docker-compose.teste.yml up -d --build --wait --wait-timeout 180 mongodb-service backend-service frontend-service nginx-service' "$tmp/docker.log"
grep -q -- '-w /work/tests/e2e' "$tmp/docker.log"
grep -q 'npx playwright test' "$tmp/docker.log"
grep -qx 'TESTFLOW_E2E_USER=admin' "$tmp/env.copy"
grep -qE '^TESTFLOW_E2E_PASSWORD=[a-f0-9]{32}$' "$tmp/env.copy"
grep -qx 'TESTFLOW_E2E_URL=https://nginx-service:8443' "$tmp/env.copy"
password=$(sed -n 's/^TESTFLOW_E2E_PASSWORD=//p' "$tmp/env.copy")
! grep -qF "$password" "$tmp/docker.log"
cleaned
echo 'ok - e2e starts the browser stack and keeps credentials off the command line'

if TESTFLOW_LEAK=report run_target e2e.sh @never@; then echo 'FAIL - e2e accepted a report' >&2; exit 1; fi
grep -q 'left a report' "$tmp/output" && cleaned
if TESTFLOW_LEAK=output run_target e2e.sh @never@; then echo 'FAIL - e2e accepted leaked output' >&2; exit 1; fi
password=$(sed -n 's/^TESTFLOW_E2E_PASSWORD=//p' "$tmp/env.copy")
grep -q 'password appears' "$tmp/output" && ! grep -qF "$password" "$tmp/output" && cleaned
echo 'ok - e2e refuses reports and password leaks'

# dast-baseline runs the ZAP plan against the same browser stack.
run_target dast-baseline.sh @never@
grep -q -- '-f docker-compose.yml -f docker-compose.teste.yml up -d --build --wait --wait-timeout 180 mongodb-service backend-service frontend-service nginx-service' "$tmp/docker.log"
grep -q 'zap.sh -cmd -autorun /zap/plan/baseline.yaml' "$tmp/docker.log"
cleaned
echo 'ok - dast-baseline runs the plan against the same stack and cleans up'

for target in e2e.sh dast-baseline.sh; do
  for failure in 'run --rm --no-deps -T backend-service' 'up -d' 'playwright test' 'zap.sh' 'down --remove-orphans'; do
    case "$target:$failure" in e2e.sh:zap.sh | dast-baseline.sh:'playwright test') continue ;; esac
    if run_target "$target" "$failure"; then echo "FAIL - $target accepted failure: $failure" >&2; exit 1; fi
    cleaned
  done
done
echo 'ok - e2e and dast-baseline propagate failures and clean up'

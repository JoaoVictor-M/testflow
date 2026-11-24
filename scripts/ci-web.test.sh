#!/bin/sh
# Exercise the e2e and DAST baseline runners with a fake Docker: what they start, what they hand to the
# test container, and how they fail and clean up.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/repo/scripts/lib" "$tmp/bin"
for script in ci-e2e.sh ci-dast-baseline.sh lib/ci-stack.sh; do cp "$root/scripts/$script" "$tmp/repo/scripts/$script"; done
cat > "$tmp/bin/docker" <<'EOF'
#!/bin/sh
echo "$*" >> "$TESTFLOW_DOCKER_LOG"
# The stack only starts with the certificate in place; the container sees the credentials by file.
case "$*" in *'up -d'*) [ -f "$TESTFLOW_CI_TLS/testflow.crt" ] && [ -f "$TESTFLOW_CI_TLS/testflow.key" ] || exit 1 ;; esac
previous=
for argument in "$@"; do
  [ "$previous" != --env-file ] || cp "$argument" "$TESTFLOW_ENV_COPY"
  previous=$argument
done
# TESTFLOW_LEAK simulates a test run that writes the password into its report or its output.
case "$*" in *playwright*)
  password=$(sed -n 's/^TESTFLOW_E2E_PASSWORD=//p' "$TESTFLOW_ENV_COPY")
  case "${TESTFLOW_LEAK:-}" in
    report) mkdir -p reports/e2e && echo "$password" > reports/e2e/relatorio.txt ;;
    output) echo "$password" ;;
  esac ;;
esac
case "$*" in *'run --rm --no-deps -T backend-service'*) cat > /dev/null; echo '$2b$10$fixture' ;; esac
case "$*" in *"$TESTFLOW_FAIL_ON"*) exit 1 ;; esac
EOF
chmod +x "$tmp/bin/docker"
printf '#!/bin/sh\nprintf "1001\\n"\n' > "$tmp/bin/id"
chmod +x "$tmp/bin/id"
run_target() {
  : > "$tmp/docker.log"
  rm -f "$tmp/env.copy"
  PATH="$tmp/bin:$PATH" TESTFLOW_DOCKER_LOG="$tmp/docker.log" TESTFLOW_ENV_COPY="$tmp/env.copy" \
    TESTFLOW_FAIL_ON="$2" sh "$tmp/repo/scripts/$1" > "$tmp/output" 2>&1
}
cleaned() { grep -q 'down --remove-orphans' "$tmp/docker.log" && [ -z "$(ls -A "$tmp/repo/.cache")" ]; }

run_target ci-e2e.sh @never@
grep -q -- '-f docker-compose.ci.yml -f docker-compose.e2e.yml up -d --build --wait --wait-timeout 180' "$tmp/docker.log"
grep -q 'run --rm --no-deps -T backend-service node -e' "$tmp/docker.log"
grep -q -- '--network testflow-ci-.*_default' "$tmp/docker.log"
grep -q -- '--user 1001:1001' "$tmp/docker.log"
grep -qE 'mcr.microsoft.com/playwright:v[0-9.]+-noble@sha256:[a-f0-9]{64}' "$tmp/docker.log"
grep -q 'npx playwright test' "$tmp/docker.log"
grep -qx 'TESTFLOW_E2E_USER=admin' "$tmp/env.copy"
grep -qE '^TESTFLOW_E2E_PASSWORD=[a-f0-9]{32}$' "$tmp/env.copy"
grep -qx 'TESTFLOW_E2E_URL=https://nginx-service:8443' "$tmp/env.copy"
password=$(sed -n 's/^TESTFLOW_E2E_PASSWORD=//p' "$tmp/env.copy")
! grep -qF "$password" "$tmp/docker.log"
cleaned
echo 'ok - e2e starts the production stack with a seeded administrator and keeps the password off the command line'

for leak in report output; do
  if TESTFLOW_LEAK=$leak run_target ci-e2e.sh @never@; then echo "FAIL - e2e accepted a password in the $leak" >&2; exit 1; fi
  grep -q 'password appears' "$tmp/output"
  cleaned
  echo "ok - e2e fails when the generated password shows up in the $leak"
done

run_target ci-dast-baseline.sh @never@
grep -q -- '-f docker-compose.ci.yml -f docker-compose.e2e.yml up -d --build --wait --wait-timeout 180' "$tmp/docker.log"
grep -q -- '--network testflow-ci-.*_default' "$tmp/docker.log"
grep -q -- '-v .*/.zap:/zap/plan:ro' "$tmp/docker.log"
grep -q 'zap.sh -cmd -autorun /zap/plan/baseline.yaml' "$tmp/docker.log"
cleaned
echo 'ok - DAST baseline runs the versioned plan against the same stack and cleans up'

for target in ci-e2e.sh ci-dast-baseline.sh; do
  for failure in 'run --rm --no-deps -T backend-service' 'up -d' 'playwright test' 'zap.sh' 'down --remove-orphans'; do
    case "$target:$failure" in ci-e2e.sh:zap.sh | ci-dast-baseline.sh:'playwright test') continue ;; esac
    if run_target "$target" "$failure"; then echo "FAIL - $target accepted failure: $failure" >&2; exit 1; fi
    cleaned
    case "$failure" in
      'run --rm'*) ! grep -q 'up -d' "$tmp/docker.log" ;;
      'up -d') ! grep -q -e 'playwright test' -e 'zap.sh' "$tmp/docker.log" ;;
    esac
    echo "ok - $target propagates $failure failure and removes temporary secrets"
  done
done

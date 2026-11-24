#!/bin/sh
# Exercise the real DAST runner with a fake Docker, including its failure and cleanup paths.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/repo/scripts/lib" "$tmp/bin"
cp "$root/scripts/ci-dast.sh" "$tmp/repo/scripts/ci-dast.sh"
cp "$root/scripts/lib/ci-stack.sh" "$tmp/repo/scripts/lib/ci-stack.sh"
cat > "$tmp/bin/docker" <<'EOF'
#!/bin/sh
echo "$*" >> "$TESTFLOW_DOCKER_LOG"
printf '%s\n' "$TESTFLOW_CI_PROJECT" > "$TESTFLOW_PROJECT_LOG"
case "$TESTFLOW_FAIL_ON:$*" in 'logs backend-service:'*'up -d'*) exit 1 ;; esac
case "$*" in *"$TESTFLOW_FAIL_ON"*) exit 1 ;; esac
EOF
chmod +x "$tmp/bin/docker"
cat > "$tmp/bin/id" <<'EOF'
#!/bin/sh
printf '1001\n'
EOF
chmod +x "$tmp/bin/id"
run_dast() {
  : > "$tmp/docker.log"
  PATH="$tmp/bin:$PATH" TESTFLOW_DOCKER_LOG="$tmp/docker.log" \
    TESTFLOW_PROJECT_LOG="$tmp/project" TESTFLOW_FAIL_ON="$1" \
    sh "$tmp/repo/scripts/ci-dast.sh" > "$tmp/output" 2>&1
}
run_dast @never@
first_project=$(cat "$tmp/project")
grep -q 'up -d --build --wait --wait-timeout 180' "$tmp/docker.log"
grep -q -- '--network testflow-ci-' "$tmp/docker.log"
grep -q -- '--user 1001:1001 -w /zap/wrk -e HOME=/tmp -e USER=zap -e JAVA_TOOL_OPTIONS=-Duser.home=/tmp' "$tmp/docker.log"
grep -q 'zap-full-scan.py -t http://backend-service:3000 -r report_html.html' "$tmp/docker.log"
grep -q 'down --remove-orphans' "$tmp/docker.log"
[ -z "$(ls -A "$tmp/repo/.cache")" ]
echo 'ok - DAST runs the full scan on an isolated network and cleans up its environment'
run_dast @never@
[ "$first_project" != "$(cat "$tmp/project")" ]
echo 'ok - concurrent runs cannot share a Compose project'
for failure in 'up -d' zap-full-scan.py 'logs backend-service' 'down --remove-orphans'; do
  if run_dast "$failure"; then echo "FAIL - DAST accepted failure: $failure" >&2; exit 1; fi
  grep -q 'down --remove-orphans' "$tmp/docker.log"
  [ -z "$(ls -A "$tmp/repo/.cache")" ]
  if [ "$failure" = 'up -d' ]; then
    grep -q 'compose .* -f docker-compose.ci.yml logs backend-service mongodb-service' "$tmp/docker.log"
    ! grep -q 'zap-full-scan.py' "$tmp/docker.log"
  fi
  echo "ok - DAST propagates $failure failure and removes temporary secrets"
done

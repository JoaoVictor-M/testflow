#!/bin/sh
# Tests check.sh with a fake docker: every target must call its tool and fail when the tool fails.
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0
log="$tmp/docker.log"
repo="$tmp/repo"

pass() { echo "ok   - $label"; }
miss() { echo "FAIL - $label"; fails=$((fails + 1)); }
run_check() {
  : >"$log"
  (cd "${CHECK_DIR:-$repo}" && PATH="$tmp/bin:$PATH" FAKE_DOCKER_LOG="$log" FAKE_DOCKER_FAIL="${FAIL_ON:-@never@}" \
    FAKE_DOCKER_SIGNAL_ON="${SIGNAL_ON:-@never@}" FAKE_DOCKER_SIGNAL="${SIGNAL:-TERM}" \
    sh scripts/check.sh "$@") >/dev/null 2>&1
}
runs() {
  target=$1; shift
  label="$target calls: $*"
  FAIL_ON= run_check "$target" || { miss; return; }
  for text in "$@"; do grep -qF -- "$text" "$log" || { miss; return; }; done
  pass
}
fails_when() {
  label="$1 fails when '$2' fails"
  if FAIL_ON=$2 run_check "$1"; then miss; else pass; fi
}

mkdir -p "$tmp/bin" "$repo/scripts/ci" "$repo/scripts/test" "$repo/testflow-app" "$repo/testflow-frontend" "$repo/tests/e2e"
cat >"$tmp/bin/docker" <<'EOF'
#!/bin/sh
echo "$*" >>"$FAKE_DOCKER_LOG"
printf 'argument=%s\n' "$@" >>"$FAKE_DOCKER_LOG"
case "$*" in *"$FAKE_DOCKER_FAIL"*) exit 1 ;; esac
case "$*" in *"$FAKE_DOCKER_SIGNAL_ON"*) kill -"$FAKE_DOCKER_SIGNAL" "$PPID"; sleep 1 ;; esac
EOF
chmod +x "$tmp/bin/docker"
cp "$here/check.sh" "$repo/scripts/check.sh"
printf '#!/bin/sh\necho test-scripts-ran >>"$FAKE_DOCKER_LOG"\n' >"$repo/scripts/test/dev.test.sh"
printf '#!/bin/sh\necho backup-ran >>"$FAKE_DOCKER_LOG"\n[ -z "${FAIL_BACKUP:-}" ]\n' >"$repo/scripts/test/backup.test.sh"
printf '#!/bin/sh\necho dast-ran >>"$FAKE_DOCKER_LOG"\n[ -z "${FAIL_DAST:-}" ]\n' >"$repo/scripts/ci/dast-full.sh"
printf '#!/bin/sh\necho e2e-ran >>"$FAKE_DOCKER_LOG"\n[ -z "${FAIL_E2E:-}" ]\n' >"$repo/scripts/ci/e2e.sh"
printf '#!/bin/sh\necho baseline-ran >>"$FAKE_DOCKER_LOG"\n[ -z "${FAIL_BASELINE:-}" ]\n' >"$repo/scripts/ci/dast-baseline.sh"
printf '#!/bin/sh\necho build-prod-ran >>"$FAKE_DOCKER_LOG"\n[ -z "${FAIL_BUILD_PROD:-}" ]\n' >"$repo/scripts/ci/build-prod.sh"
printf '#!/bin/sh\necho "scan-prod-ran $TRIVY_IMAGE" >>"$FAKE_DOCKER_LOG"\n[ -z "${FAIL_SCAN_PROD:-}" ]\n' >"$repo/scripts/ci/scan-prod.sh"
printf 'FROM scratch\n' >"$repo/testflow-app/Dockerfile"
git init -q -b main "$repo"
git -C "$repo" add .

runs lint 'npm ci --engine-strict' 'npm run lint' '-w /work/testflow-app' '-w /work/testflow-frontend'
runs build-inputs 'TESTFLOW_NODE_IMAGE=node:' 'scripts/ci/build-inputs.cjs'
fails_when build-inputs 'scripts/ci/build-inputs.cjs'
runs audit 'npm audit' '-w /work/testflow-app' '-w /work/testflow-frontend' '-w /work/tests/e2e'
fails_when audit '-w /work/testflow-app'
fails_when audit '-w /work/testflow-frontend'
fails_when audit '-w /work/tests/e2e'
runs image-scan 'build --target prod -t testflow-ci-backend-repo:prod' 'save -o' 'image --cache-dir' \
  '--input /work/.cache/testflow-image.' '--severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 1'
fails_when image-scan 'build --target prod'
fails_when image-scan 'save -o'
fails_when image-scan 'image --cache-dir'
fails_when lint '-w /work/testflow-app'
fails_when lint '-w /work/testflow-frontend'
runs build 'npm ci --engine-strict' 'npm run build' '-w /work/testflow-frontend'
fails_when build 'npm run build'
runs test 'compose --env-file /dev/null -p testflow-teste-repo -f docker-compose.yml -f docker-compose.teste.yml' \
  'up -d --wait mongodb-service mailpit' '--network testflow-teste-repo_default' \
  '-w /work/testflow-app' '-w /work/testflow-frontend' 'npm ci --engine-strict' 'npm test' ' down'
fails_when test 'up -d --wait'
fails_when test '-w /work/testflow-app'
fails_when test '-w /work/testflow-frontend'

tears_down() {
  label="test removes the database when $1"
  if FAIL_ON=$2 run_check test; then miss
  elif grep -qF -- 'compose --env-file /dev/null -p testflow-teste-repo -f docker-compose.yml -f docker-compose.teste.yml down' "$log"; then pass
  else miss; fi
}
tears_down 'the back tests fail' '-w /work/testflow-app'
tears_down 'the database does not start' 'up -d --wait'

interrupted() {
  label="test removes the database when $1 interrupts it"
  if SIGNAL=$1 SIGNAL_ON='-w /work/testflow-app' run_check test; then miss
  elif grep -qF -- 'compose --env-file /dev/null -p testflow-teste-repo -f docker-compose.yml -f docker-compose.teste.yml down' "$log" \
    && ! grep -qF -- '-w /work/testflow-frontend' "$log"; then pass
  else miss; fi
}
interrupted INT
interrupted TERM

label="the test project is testflow-teste-<worktree folder>, so two worktrees never share one"
FAIL_ON= run_check test; first=$(grep -oE 'compose --env-file /dev/null -p [a-z0-9_-]+' "$log" | sort -u)
cp -R "$repo" "$tmp/Other Tree"
CHECK_DIR="$tmp/Other Tree" FAIL_ON= run_check test; second=$(grep -oE 'compose --env-file /dev/null -p [a-z0-9_-]+' "$log" | sort -u)
if [ "$first" = 'compose --env-file /dev/null -p testflow-teste-repo' ] && [ "$second" = 'compose --env-file /dev/null -p testflow-teste-other-tree' ]; then pass; else miss; fi

label="test never uses the project of dev.sh, even in a worktree folder named dev"
mkdir "$tmp/dev" && cp -R "$repo/." "$tmp/dev/"
CHECK_DIR="$tmp/dev" FAIL_ON= run_check test
if grep -qE 'compose --env-file /dev/null -p testflow-teste-dev ' "$log" && ! grep -qE 'compose .* -p testflow-dev( |$)' "$log"; then pass; else miss; fi

label="test starts from a clean state: the first Compose call removes leftovers of an earlier run"
FAIL_ON= run_check test
if grep -m1 'compose ' "$log" | grep -q ' down --remove-orphans'; then pass; else miss; fi

runs test-repository 'node:20.20.2@sha256:' 'node --test scripts/test/*.test.cjs'
fails_when test-repository 'node --test'
runs secrets 'gitleaks' 'git .'
fails_when secrets gitleaks
runs secrets-staged 'gitleaks' '--staged'
fails_when secrets-staged gitleaks
runs sast 'semgrep scan' '--error' '--jobs 1' '--config p/owasp-top-ten' '--config p/nodejs' '--config p/javascript' \
  '--config p/react' '--config p/secrets'
fails_when sast 'semgrep scan'
runs sca 'trivy' 'fs' '-w /work/testflow-app' '-w /work/testflow-frontend' '-w /work/tests/e2e' 'npm audit --audit-level=high'
fails_when sca 'trivy'
fails_when sca '-w /work/testflow-app'
fails_when sca '-w /work/testflow-frontend'
fails_when sca '-w /work/tests/e2e'
runs iac 'hadolint' 'testflow-app/Dockerfile' 'actionlint' 'docker-compose.yml config -q' \
  'docker-compose.dev.yml config -q' 'docker-compose.teste.yml config -q' 'config --quiet'
fails_when iac 'hadolint'
fails_when iac 'actionlint'
fails_when iac 'docker-compose.teste.yml config -q'
fails_when iac 'config --quiet'

label="iac includes unstaged Dockerfiles and preserves spaces in their paths"
mkdir -p "$repo/new image"
printf 'FROM scratch\n' >"$repo/new image/Dockerfile"
FAIL_ON= run_check iac && grep -qxF 'argument=new image/Dockerfile' "$log" && pass || miss
label="iac propagates a lint failure in an unstaged Dockerfile"
if FAIL_ON='new image/Dockerfile' run_check iac; then miss; else pass; fi
label="iac excludes ignored Dockerfiles"
printf 'ignored/\n' >"$repo/.gitignore"
mkdir -p "$repo/ignored"
printf 'FROM scratch\n' >"$repo/ignored/Dockerfile"
FAIL_ON= run_check iac && ! grep -qF 'ignored/Dockerfile' "$log" && pass || miss
label="iac skips deleted tracked Dockerfiles"
rm "$repo/testflow-app/Dockerfile"
FAIL_ON= run_check iac && ! grep -qF 'testflow-app/Dockerfile' "$log" && pass || miss
printf 'FROM scratch\n' >"$repo/testflow-app/Dockerfile"
label="iac fails clearly when no Dockerfiles exist"
rm "$repo/testflow-app/Dockerfile" "$repo/new image/Dockerfile"
if FAIL_ON= run_check iac; then miss; else pass; fi
printf 'FROM scratch\n' >"$repo/testflow-app/Dockerfile"

runs test-scripts 'test-scripts-ran'
label="test-scripts leaves out backup.test.sh, which needs the Docker daemon (integration runs it)"
FAIL_ON= run_check test-scripts && ! grep -qF backup-ran "$log" && pass || miss
runs integration 'backup-ran'
label="integration fails when the backup test fails"
if FAIL_BACKUP=1 FAIL_ON= run_check integration; then miss; else pass; fi
runs dast-full 'dast-ran'
runs build-prod 'build-prod-ran'
runs scan-prod 'scan-prod-ran aquasec/trivy:'
label="production build and scan targets propagate failures"
if FAIL_BUILD_PROD=1 FAIL_ON= run_check build-prod; then miss
elif FAIL_SCAN_PROD=1 FAIL_ON= run_check scan-prod; then miss
else pass; fi
label="dast-full fails when the DAST script fails"
if FAIL_DAST=1 FAIL_ON= run_check dast-full; then miss; else pass; fi
label="dast-full stays out of quality and all: the release runs it"
if FAIL_ON= run_check quality && ! grep -qF dast-ran "$log" && FAIL_ON= run_check all && ! grep -qF dast-ran "$log"; then pass; else miss; fi
runs e2e 'e2e-ran'
label="e2e fails when the browser tests fail"
if FAIL_E2E=1 FAIL_ON= run_check e2e; then miss; else pass; fi
runs dast 'baseline-ran'
label="dast fails when the baseline fails"
if FAIL_BASELINE=1 FAIL_ON= run_check dast; then miss; else pass; fi
label="all runs e2e and the DAST baseline; quality runs neither"
if FAIL_ON= run_check quality && ! grep -qF e2e-ran "$log" && ! grep -qF baseline-ran "$log" &&
  FAIL_ON= run_check all && grep -qF e2e-ran "$log" && grep -qF baseline-ran "$log"; then pass; else miss; fi
runs quality 'npm run lint' 'npm test' 'test-scripts-ran' 'node --test' 'npm run build'
fails_when quality 'npm run lint'
fails_when quality 'scripts/ci/build-inputs.cjs'
fails_when quality 'npm test'
fails_when quality 'npm run build'
fails_when quality 'node --test'
runs all 'npm run lint' 'backup-ran' 'gitleaks' 'semgrep scan' 'npm audit' 'hadolint' 'actionlint'

label="unknown target exits 2"
FAIL_ON= run_check nonsense && miss || { [ $? -eq 2 ] && pass || miss; }
label="no target exits 2"
FAIL_ON= run_check && miss || { [ $? -eq 2 ] && pass || miss; }

label="every tool image is pinned by tag and digest"
images=$(grep -E '^[A-Z0-9_]+_IMAGE=' "$here/check.sh")
if [ -n "$images" ] && ! printf '%s\n' "$images" | grep -Evq '_IMAGE=[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$'; then pass; else miss; fi

git -C "$repo" -c user.email=t@example.invalid -c user.name=t commit -q -m 'chore: base'
git -C "$repo" worktree add -q "$tmp/tree" -b feat/x
common=$(cd "$repo" && git rev-parse --path-format=absolute --git-common-dir)
label="secrets inside a worktree mounts the shared git directory"
: >"$log"
(cd "$tmp/tree" && PATH="$tmp/bin:$PATH" FAKE_DOCKER_LOG="$log" FAKE_DOCKER_FAIL=@never@ sh scripts/check.sh secrets) >/dev/null 2>&1
if grep -qF -- "-v $common:$common" "$log"; then pass; else miss; fi

[ "$fails" -eq 0 ] && echo "check: all passed" || { echo "check: $fails failed" >&2; exit 1; }

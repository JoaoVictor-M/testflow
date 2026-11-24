#!/bin/sh
# Tests check.sh with a fake docker: every target must call its tool and fail when the tool fails.
# The tools themselves are proven against real violations when check.sh changes (see the task note).
set -eu
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0
log="$tmp/docker.log"
repo="$tmp/repo"

pass() { echo "ok   - $label"; }
miss() { echo "FAIL - $label"; fails=$((fails + 1)); }
# run_check <target>...: runs check.sh in the throwaway repository; FAIL_ON makes the fake docker fail
# when its arguments contain that text.
run_check() {
  : >"$log"
  (cd "$repo" && PATH="$tmp/bin:$PATH" FAKE_DOCKER_LOG="$log" FAKE_DOCKER_FAIL="${FAIL_ON:-@never@}" \
    sh scripts/check.sh "$@") >/dev/null 2>&1
}
# runs <target> <text>...: the target succeeds and the tools it called mention every text.
runs() {
  target=$1; shift
  label="$target calls: $*"
  FAIL_ON= run_check "$target" || { miss; return; }
  for text in "$@"; do grep -qF -- "$text" "$log" || { miss; return; }; done
  pass
}
# fails <target> <text>: the target fails when the docker call containing <text> fails.
fails_when() {
  label="$1 fails when '$2' fails"
  if FAIL_ON=$2 run_check "$1"; then miss; else pass; fi
}

mkdir -p "$tmp/bin" "$repo/scripts/git-hooks" "$repo/testflow-app" "$repo/testflow-frontend"
cat >"$tmp/bin/docker" <<'EOF'
#!/bin/sh
echo "$*" >>"$FAKE_DOCKER_LOG"
printf 'argument=%s\n' "$@" >>"$FAKE_DOCKER_LOG"
case "$*" in *"$FAKE_DOCKER_FAIL"*) exit 1 ;; esac
EOF
chmod +x "$tmp/bin/docker"
cp "$here/check.sh" "$repo/scripts/check.sh"
for stub in scripts/git-hooks/guards.test.sh scripts/dev.test.sh; do
  printf '#!/bin/sh\necho test-scripts-ran >>"$FAKE_DOCKER_LOG"\n' >"$repo/$stub"
done
printf 'FROM scratch\n' >"$repo/testflow-app/Dockerfile"
git init -q -b main "$repo"
git -C "$repo" add .

runs lint 'npm run lint' '-w /work/testflow-app' '-w /work/testflow-frontend'
fails_when lint '-w /work/testflow-app'
fails_when lint '-w /work/testflow-frontend'
runs build 'npm run build' '-w /work/testflow-frontend'
fails_when build 'npm run build'
runs secrets 'gitleaks' 'git .'
fails_when secrets gitleaks
runs secrets-staged 'gitleaks' '--staged'
fails_when secrets-staged gitleaks
runs sast 'semgrep scan' '--error' '--config p/owasp-top-ten' '--config p/nodejs' '--config p/javascript' \
  '--config p/react' '--config p/secrets'
fails_when sast 'semgrep scan'
runs sca 'trivy' 'fs' '-w /work/testflow-app' '-w /work/testflow-frontend' 'npm audit --audit-level=high'
fails_when sca 'trivy'
fails_when sca '-w /work/testflow-app'
fails_when sca '-w /work/testflow-frontend'
runs iac 'hadolint' 'testflow-app/Dockerfile' 'config --quiet'
fails_when iac 'hadolint'
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
runs quality 'npm run lint' 'test-scripts-ran' 'npm run build'
fails_when quality 'npm run lint'
fails_when quality 'npm run build'
runs all 'npm run lint' 'gitleaks' 'semgrep scan' 'npm audit' 'hadolint'

label="typecheck does not exist (the project is JavaScript)"
if FAIL_ON= run_check typecheck; then miss; else pass; fi
label="unknown target exits 2"
FAIL_ON= run_check nonsense && miss || { [ $? -eq 2 ] && pass || miss; }
label="no target exits 2"
FAIL_ON= run_check && miss || { [ $? -eq 2 ] && pass || miss; }

label="every tool image is pinned by tag and digest"
images=$(grep -E '^[A-Z0-9_]+_IMAGE=' "$here/check.sh")
if [ -n "$images" ] && ! printf '%s\n' "$images" | grep -Evq '_IMAGE=[a-z0-9./_-]+:[A-Za-z0-9._-]+@sha256:[0-9a-f]{64}$'; then pass; else miss; fi

# In a git worktree .git is a file pointing outside the checkout; Gitleaks needs that directory too.
git -C "$repo" -c user.email=t@example.invalid -c user.name=t commit -q -m 'chore: base'
git -C "$repo" worktree add -q "$tmp/tree" -b feat/x
common=$(cd "$repo" && git rev-parse --path-format=absolute --git-common-dir)
label="secrets inside a worktree mounts the shared git directory"
: >"$log"
(cd "$tmp/tree" && PATH="$tmp/bin:$PATH" FAKE_DOCKER_LOG="$log" FAKE_DOCKER_FAIL=@never@ sh scripts/check.sh secrets) >/dev/null 2>&1
if grep -qF -- "-v $common:$common" "$log"; then pass; else miss; fi

[ "$fails" -eq 0 ] && echo "check: all passed" || { echo "check: $fails failed" >&2; exit 1; }

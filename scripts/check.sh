#!/bin/sh
# Every local check, each in a container pinned by tag and digest, so nothing is installed on the host.
# Usage: scripts/check.sh <target>... | all
#   quality  lint, test, test-scripts, test-repository, build
#                                              secrets   Gitleaks over the whole history
#   sast     Semgrep                           sca       Trivy fs + npm audit
#   iac      Hadolint + Trivy config           all       every target above
#   test     unit and integration tests with coverage (back against a throwaway MongoDB, front in jsdom)
# Targets for the stack (integration, e2e, DAST, load, release) arrive with the tasks that need them.
set -eu
cd "$(dirname "$0")/.."

# Pin every image by tag and digest; refresh them on each release.
NODE_IMAGE=node:20@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5
SEMGREP_IMAGE=semgrep/semgrep:1.185.0@sha256:67518c174185a2043fdbed16c70631b79209499b3671178e7194379b48295a0d
GITLEAKS_IMAGE=ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f
HADOLINT_IMAGE=hadolint/hadolint:v2.15.1@sha256:32dac94127fd60b7b7e3fbfc65e1383b9b5e25c9bfd7b8536de7a539fe68a12d
TRIVY_IMAGE=aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb

BACK=testflow-app
FRONT=testflow-frontend
REPORTS=reports
SEMGREP_RULES='p/owasp-top-ten p/nodejs p/javascript p/react p/secrets'

# In a git worktree .git is a file that points to a directory outside the checkout; mount it so git
# works inside the containers.
git_mount=
if [ -f .git ]; then
  common=$(git rev-parse --path-format=absolute --git-common-dir)
  git_mount="-v $common:$common"
fi

run() {
  # shellcheck disable=SC2086 # git_mount is a flag pair or empty
  docker run --rm --init --user "$(id -u):$(id -g)" -e HOME=/tmp -e CI -e npm_config_cache=/work/.cache/npm \
    -v "$PWD":/work $git_mount -w /work "$@"
}
# node <directory> <command>: a shell command in the Node image, inside one of the two projects.
node() { run -w "/work/$1" "$NODE_IMAGE" sh -c "$2"; }

check() {
  case $1 in
    all) for target in quality secrets sast sca iac; do check "$target"; done ;;
    quality) for target in lint test test-scripts test-repository build; do check "$target"; done ;;
    # The project's own shell tests: git hooks, dev.sh and this script.
    test-scripts) for test in scripts/git-hooks/*.test.sh scripts/*.test.sh; do sh "$test"; done ;;
    # Repository tests (ignore rules, workflows, Dockerfiles and Compose files) in Node with the Docker
    # CLI, which only renders configuration.
    test-repository)
      docker build --quiet --tag testflow-check-tools --build-arg "NODE_IMAGE=$NODE_IMAGE" \
        --file scripts/test/tools.Dockerfile scripts/test >/dev/null
      run testflow-check-tools sh -c 'node --test scripts/test/*.test.cjs'
      ;;

    lint) for dir in "$BACK" "$FRONT"; do node "$dir" 'npm ci && npm run lint'; done ;;
    build) node "$FRONT" 'npm ci && npm run build' ;;

    # Tests with coverage; the minimums live in testflow-app/.c8rc.json and the front vite.config.js.
    test) check test-back; check test-front ;;
    # The services live in a Compose project named after the worktree folder, with its own network and
    # no published port, so two worktrees test at the same time and never reach the real data; the trap
    # removes them on failure, Ctrl-C and normal exit. The back reaches the database by the service
    # name on that network.
    test-back)
      project="testflow-$(basename "$PWD" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n_-' '-')"
      compose="docker compose -p $project -f docker-compose.teste.yml"
      trap '$compose down --remove-orphans' EXIT
      trap 'exit 130' INT
      trap 'exit 143' TERM
      # A previous run killed without cleanup must not leave its database behind.
      $compose down --remove-orphans
      $compose up -d --wait
      run --network "${project}_default" -w "/work/$BACK" "$NODE_IMAGE" sh -c 'npm ci && npm test'
      $compose down --remove-orphans
      trap - EXIT INT TERM
      ;;
    test-front) node "$FRONT" 'npm ci && npm test' ;;

    # Gitleaks over the full git history.
    secrets)
      mkdir -p "$REPORTS"
      run "$GITLEAKS_IMAGE" git . --redact --no-banner --report-format sarif --report-path "$REPORTS/gitleaks.sarif"
      ;;
    # Gitleaks over the staged changes only (pre-commit hook).
    secrets-staged) run "$GITLEAKS_IMAGE" git . --pre-commit --staged --redact --no-banner ;;

    # Semgrep CE; fails on any finding (the image expects the code in /src).
    sast)
      mkdir -p "$REPORTS"
      rules=""
      for rule in $SEMGREP_RULES; do rules="$rules --config $rule"; done
      # shellcheck disable=SC2086 # rules is a flag list
      run -v "$PWD":/src -w /src "$SEMGREP_IMAGE" semgrep scan --metrics=off --error \
        --sarif --output "$REPORTS/semgrep.sarif" $rules
      ;;
    # Vulnerable dependencies from every lockfile; fails on high or critical. An accepted CVE goes in
    # .trivyignore with the reason and an expiry date; the gate itself is never lowered.
    sca)
      mkdir -p "$REPORTS" .cache/trivy
      run "$TRIVY_IMAGE" fs --quiet --cache-dir /work/.cache/trivy --scanners vuln \
        --severity HIGH,CRITICAL --exit-code 1 --skip-dirs '**/node_modules' .
      for dir in "$BACK" "$FRONT"; do node "$dir" 'npm audit --audit-level=high'; done
      ;;
    # Hadolint and Trivy config scan of the Dockerfiles and compose files; both run, so one report
    # shows every finding.
    iac)
      mkdir -p .cache/trivy
      failed=0
      # Include new files before staging, respect gitignore and preserve spaces in paths.
      dockerfiles=$(git ls-files --cached --others --exclude-standard --deduplicate -- '*Dockerfile*')
      set --
      while IFS= read -r dockerfile; do
        [ ! -f "$dockerfile" ] || set -- "$@" "$dockerfile"
      done <<EOF
$dockerfiles
EOF
      [ "$#" -gt 0 ] || { echo 'check.sh: no Dockerfiles found' >&2; return 1; }
      run "$HADOLINT_IMAGE" hadolint "$@" || failed=1
      run "$TRIVY_IMAGE" config --quiet --cache-dir /work/.cache/trivy --exit-code 1 \
        --severity HIGH,CRITICAL --skip-dirs '**/node_modules' . || failed=1
      [ "$failed" -eq 0 ]
      ;;

    *) echo "check.sh: unknown target '$1'" >&2; exit 2 ;;
  esac
}

[ $# -gt 0 ] || { echo 'usage: scripts/check.sh <target>... | all' >&2; exit 2; }
for target in "$@"; do check "$target"; done

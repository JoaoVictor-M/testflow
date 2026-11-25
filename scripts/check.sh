#!/bin/sh
# Every local check, each in a container pinned by tag and digest, so nothing is installed on the host.
# Usage: scripts/check.sh <target>... | all
#   quality  build-inputs, lint, test, test-scripts, test-repository, build
#   secrets  Gitleaks over the whole history      sast   Semgrep
#   sca      Trivy fs + npm audit                 iac    Hadolint + Actionlint + Compose + Trivy config
#   integration  backup and restore on a throwaway MongoDB
#   e2e      Playwright against the production images   dast  ZAP baseline (Medium or higher fails)
#   all      quality, integration, e2e, secrets, sast, sca, iac, dast
#   build-inputs, audit, test, test-back, test-front, image-scan, dast-full, build-prod, scan-prod
set -eu
cd "$(dirname "$0")/.."

# Pin every image by tag and digest; refresh them on each release.
NODE_IMAGE=node:20.20.2@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5
SEMGREP_IMAGE=semgrep/semgrep:1.185.0@sha256:67518c174185a2043fdbed16c70631b79209499b3671178e7194379b48295a0d
GITLEAKS_IMAGE=ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f
HADOLINT_IMAGE=hadolint/hadolint:v2.15.1@sha256:32dac94127fd60b7b7e3fbfc65e1383b9b5e25c9bfd7b8536de7a539fe68a12d
ACTIONLINT_IMAGE=rhysd/actionlint:1.7.9@sha256:a0383f60d92601e2694e24b24d37df7b6a40bed7cedbc447611c50009bf02d94
TRIVY_IMAGE=aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb

BACK=testflow-app
FRONT=testflow-frontend
E2E=tests/e2e
REPORTS=reports
SEMGREP_RULES='p/owasp-top-ten p/nodejs p/javascript p/react p/secrets'
WORKTREE=$(basename "$PWD" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n_-' '-')

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
# node <directory> <command>: a shell command in the Node image, inside one of the projects.
node() { run -w "/work/$1" "$NODE_IMAGE" sh -c "$2"; }

check() {
  case $1 in
    all) for target in quality integration e2e secrets sast sca iac dast; do check "$target"; done ;;
    quality) for target in build-inputs lint test test-scripts test-repository build; do check "$target"; done ;;
    build-inputs)
      ci_node=$(run "$NODE_IMAGE" node -p process.versions.node)
      ci_npm=$(run "$NODE_IMAGE" npm --version)
      for target_spec in "base:$BACK" "prod:$BACK" "base:$FRONT"; do
        stage=${target_spec%%:*}
        dir=${target_spec#*:}
        image_id=$(docker build --quiet --target "$stage" "$dir")
        actual_node=$(docker run --rm "$image_id" node -p process.versions.node)
        [ -n "$ci_node" ] && [ "$actual_node" = "$ci_node" ] \
          || { echo "build-inputs: $dir ($stage) Node '$actual_node' != CI '$ci_node'" >&2; exit 1; }
        if [ "$stage" = base ]; then
          actual_npm=$(docker run --rm "$image_id" npm --version)
          [ -n "$ci_npm" ] && [ "$actual_npm" = "$ci_npm" ] \
            || { echo "build-inputs: $dir ($stage) npm '$actual_npm' != CI '$ci_npm'" >&2; exit 1; }
        fi
      done
      mkdir -p "$REPORTS/build-inputs"
      run -e "TESTFLOW_NODE_IMAGE=$NODE_IMAGE" "$NODE_IMAGE" sh -eu -c '
        tmp=$(mktemp -d /tmp/testflow-build-inputs-XXXXXX)
        trap '\''rm -rf "$tmp"'\'' EXIT
        TESTFLOW_NPM_VERSION=$(npm --version); export TESTFLOW_NPM_VERSION
        for c in testflow-app testflow-frontend; do
          for p in ci build; do
            d="$tmp/$c-$p"; mkdir -p "$d"
            cp "$c/package.json" "$c/package-lock.json" "$d/"
            [ ! -f "$c/.npmrc" ] || cp "$c/.npmrc" "$d/"
            (cd "$d" && npm ci --engine-strict --no-audit --no-fund)
            node scripts/ci/build-inputs.cjs "$d" >"reports/build-inputs/$c-$p.json"
          done
          cmp "reports/build-inputs/$c-ci.json" "reports/build-inputs/$c-build.json"
          if [ "$c" = testflow-app ]; then
            d="$tmp/backend-prod"; mkdir -p "$d"
            cp "$c/package.json" "$c/package-lock.json" "$d/"
            [ ! -f "$c/.npmrc" ] || cp "$c/.npmrc" "$d/"
            (cd "$d" && npm ci --engine-strict --omit=dev --no-audit --no-fund)
            node scripts/ci/build-inputs.cjs "$d" production >reports/build-inputs/testflow-app-production.json
            node -e '\''const a=require("node:assert/strict"),f=require("./reports/build-inputs/testflow-app-ci.json"),p=require("./reports/build-inputs/testflow-app-production.json");a.equal(f.productionTreeSha256,p.treeSha256);a.equal(f.lockSha256,p.lockSha256)'\''
          fi
        done'
      ;;
    audit) for dir in "$BACK" "$FRONT" "$E2E"; do node "$dir" 'npm audit'; done ;;
    image-scan)
      image_tag="testflow-ci-backend-$WORKTREE:prod"
      docker build --target prod -t "$image_tag" "$BACK"
      mkdir -p .cache/trivy
      # Scan a saved image instead of giving the scanner access to the Docker socket.
      archive=$(mktemp "$PWD/.cache/testflow-image.XXXXXX.tar")
      trap 'rm -f "$archive"' EXIT
      trap 'exit 130' INT
      trap 'exit 143' TERM
      docker save -o "$archive" "$image_tag"
      run "$TRIVY_IMAGE" image --cache-dir /work/.cache/trivy --input "/work/.cache/$(basename "$archive")" \
        --scanners vuln --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 1
      rm -f "$archive"
      trap - EXIT INT TERM
      ;;
    dast-full) sh scripts/ci/dast-full.sh ;;
    build-prod) sh scripts/ci/build-prod.sh ;;
    scan-prod) TRIVY_IMAGE="$TRIVY_IMAGE" sh scripts/ci/scan-prod.sh ;;
    # Both start a disposable stack of the production images; they need the Docker daemon.
    e2e) sh scripts/ci/e2e.sh ;;
    dast) sh scripts/ci/dast-baseline.sh ;;
    # Behavior-based shell tests; backup.test.sh runs in integration instead.
    test-scripts)
      for test in scripts/test/*.test.sh; do
        [ "$test" = scripts/test/backup.test.sh ] || sh "$test"
      done
      ;;
    integration) sh scripts/test/backup.test.sh ;;
    test-repository) run "$NODE_IMAGE" sh -c 'node --test scripts/test/*.test.cjs' ;;

    lint) for dir in "$BACK" "$FRONT"; do node "$dir" 'npm ci --engine-strict && npm run lint'; done ;;
    build) node "$FRONT" 'npm ci --engine-strict && npm run build' ;;

    # Tests with coverage; the minimums live in testflow-app/.c8rc.json and the front vite.config.js.
    test) check test-back; check test-front ;;
    # Disposable MongoDB + Mailpit in a Compose project per worktree (never touches dev or production).
    test-back)
      project="testflow-teste-$WORKTREE"
      compose="docker compose --env-file /dev/null -p $project -f docker-compose.yml -f docker-compose.teste.yml"
      trap '$compose down --remove-orphans' EXIT
      trap 'exit 130' INT
      trap 'exit 143' TERM
      $compose down --remove-orphans
      $compose up -d --wait mongodb-service mailpit
      run --network "${project}_default" -w "/work/$BACK" "$NODE_IMAGE" sh -c 'npm ci --engine-strict && npm test'
      $compose down --remove-orphans
      trap - EXIT INT TERM
      ;;
    test-front) node "$FRONT" 'npm ci --engine-strict && npm test' ;;

    # Gitleaks over the full git history.
    secrets)
      mkdir -p "$REPORTS"
      run "$GITLEAKS_IMAGE" git . --redact --no-banner --report-format sarif --report-path "$REPORTS/gitleaks.sarif"
      ;;
    # Gitleaks over the staged changes only (pre-commit hook).
    secrets-staged) run "$GITLEAKS_IMAGE" git . --pre-commit --staged --redact --no-banner ;;

    # Semgrep CE; fails on any finding (the image expects the code in /src). One job: with parallel
    # jobs it can silently miss taint findings, so the result would depend on the machine's cores.
    sast)
      mkdir -p "$REPORTS"
      rules=""
      for rule in $SEMGREP_RULES; do rules="$rules --config $rule"; done
      # shellcheck disable=SC2086 # rules is a flag list
      run -v "$PWD":/src -w /src "$SEMGREP_IMAGE" semgrep scan --metrics=off --error --jobs 1 \
        --sarif --output "$REPORTS/semgrep.sarif" $rules
      ;;
    # Vulnerable dependencies from every lockfile; fails on high or critical. An accepted CVE goes in
    # .trivyignore with the reason and an expiry date; the gate itself is never lowered.
    sca)
      mkdir -p "$REPORTS" .cache/trivy
      run "$TRIVY_IMAGE" fs --quiet --cache-dir /work/.cache/trivy --scanners vuln \
        --severity HIGH,CRITICAL --exit-code 1 --skip-dirs '**/node_modules' .
      for dir in "$BACK" "$FRONT" "$E2E"; do node "$dir" 'npm audit --audit-level=high'; done
      ;;
    # Hadolint, Actionlint, Compose rendering and Trivy config scan; every check runs so one report
    # shows all findings.
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
      run "$ACTIONLINT_IMAGE" -color || failed=1
      docker compose --env-file /dev/null -f docker-compose.yml config -q || failed=1
      docker compose --env-file /dev/null -f docker-compose.yml -f docker-compose.dev.yml config -q || failed=1
      docker compose --env-file /dev/null -f docker-compose.yml -f docker-compose.teste.yml config -q || failed=1
      run "$TRIVY_IMAGE" config --quiet --cache-dir /work/.cache/trivy --exit-code 1 \
        --severity HIGH,CRITICAL --skip-dirs '**/node_modules' . || failed=1
      [ "$failed" -eq 0 ]
      ;;

    *) echo "check.sh: unknown target '$1'" >&2; exit 2 ;;
  esac
}

[ $# -gt 0 ] || { echo 'usage: scripts/check.sh <target>... | all' >&2; exit 2; }
for target in "$@"; do check "$target"; done

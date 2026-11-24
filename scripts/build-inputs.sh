#!/bin/sh
# Called inside the pinned Node container by check.sh; install directories never share node_modules.
set -eu
temporary=$(mktemp -d /tmp/testflow-build-inputs-XXXXXX)
trap 'rm -rf "$temporary"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
export TESTFLOW_NPM_VERSION
TESTFLOW_NPM_VERSION=$(npm --version)
mkdir -p reports/build-inputs
node --test scripts/test/build-inputs.test.cjs

for component in testflow-app testflow-frontend; do
  for phase in ci build; do
    directory="$temporary/$component-$phase"
    mkdir -p "$directory"
    cp "$component/package.json" "$component/package-lock.json" "$directory/"
    if [ -f "$component/.npmrc" ]; then cp "$component/.npmrc" "$directory/"; fi
    (cd "$directory" && npm ci --engine-strict --no-audit --no-fund)
    node scripts/lib/build-inputs.cjs "$directory" >"reports/build-inputs/$component-$phase.json"
  done
  cmp "reports/build-inputs/$component-ci.json" "reports/build-inputs/$component-build.json"
  if [ "$component" = testflow-app ]; then
    directory="$temporary/backend-production"
    mkdir -p "$directory"
    cp "$component/package.json" "$component/package-lock.json" "$directory/"
    if [ -f "$component/.npmrc" ]; then cp "$component/.npmrc" "$directory/"; fi
    (cd "$directory" && npm ci --engine-strict --omit=dev --no-audit --no-fund)
    node scripts/lib/build-inputs.cjs "$directory" production >reports/build-inputs/testflow-app-production.json
    node -e '
      const assert = require("node:assert/strict");
      const full = require("./reports/build-inputs/testflow-app-ci.json");
      const production = require("./reports/build-inputs/testflow-app-production.json");
      assert.equal(full.productionTreeSha256, production.treeSha256);
      assert.equal(full.lockSha256, production.lockSha256);
    '
  fi
  node -e 'const r = require("./reports/build-inputs/" + process.argv[1] + "-ci.json"); console.log(process.argv[1], JSON.stringify({node: r.node, npm: r.npm, image: r.nodeImage, lock: r.lockSha256, tree: r.treeSha256}));' "$component"
done

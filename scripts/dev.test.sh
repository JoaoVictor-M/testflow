#!/bin/sh
# Tests that dev.sh only prepares the environment (.env, git hooks) when it brings the stack up.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0
repo="$tmp/repo"

pass() { echo "ok   - $label"; }
miss() { echo "FAIL - $label"; fails=$((fails + 1)); }
dev() { (cd "$repo" && PATH="$tmp/bin:$PATH" FAKE_DOCKER_LOG="$tmp/docker.log" sh scripts/dev.sh "$@") >/dev/null 2>&1; }
untouched() { [ ! -e "$repo/.env" ] && [ -z "$(git -C "$repo" config --local core.hooksPath || true)" ]; }

mkdir -p "$tmp/bin" "$repo/scripts"
printf '#!/bin/sh\necho "$*" >>"$FAKE_DOCKER_LOG"\n' >"$tmp/bin/docker"
chmod +x "$tmp/bin/docker"
cp "$here/dev.sh" "$repo/scripts/dev.sh"
echo 'JWT_SECRET=placeholder' >"$repo/.env.example"
git init -q -b main "$repo"

label="logs leaves .env and the git hooks alone"; dev logs && untouched && pass || miss
label="down leaves .env and the git hooks alone"; dev down && untouched && pass || miss
label="an invalid argument exits 2 and leaves .env and the git hooks alone"
if dev bogus; then miss; else [ $? -eq 2 ] && untouched && pass || miss; fi
label="up creates .env, turns on the git hooks and starts the stack"
dev up && cmp -s "$repo/.env" "$repo/.env.example" \
  && [ "$(git -C "$repo" config --local core.hooksPath)" = scripts/git-hooks ] \
  && grep -q 'compose up' "$tmp/docker.log" && pass || miss
label="up keeps an existing .env"
echo 'JWT_SECRET=mine' >"$repo/.env"; dev up && grep -qx 'JWT_SECRET=mine' "$repo/.env" && pass || miss

[ "$fails" -eq 0 ] && echo "dev: all passed" || { echo "dev: $fails failed" >&2; exit 1; }

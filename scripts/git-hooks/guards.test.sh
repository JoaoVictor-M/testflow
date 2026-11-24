#!/bin/sh
# Tests guard-commit.sh, guard-push.sh and commit-msg in a throwaway repository with a bare remote.
set -eu
hooks=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fails=0

ok() { if "$@" >/dev/null 2>&1; then echo "ok   - $label"; else echo "FAIL - $label"; fails=$((fails + 1)); fi; }
no() { if "$@" >/dev/null 2>&1; then echo "FAIL - $label"; fails=$((fails + 1)); else echo "ok   - $label"; fi; }
# Feeds guard-push the line git would send for "git push origin <local>:<remote>".
push() {
  remote_sha=$(git rev-parse -q --verify "refs/remotes/origin/$2" || echo 0000000000000000000000000000000000000000)
  echo "refs/heads/$1 $(git rev-parse "$1") refs/heads/$2 $remote_sha" | sh "$hooks/guard-push.sh"
}
delete() { echo "(delete) 0000000000000000000000000000000000000000 refs/heads/$1 $(git rev-parse "origin/$1")" | sh "$hooks/guard-push.sh"; }
commit() { git commit -q --allow-empty -m "$1"; }

git init -q --bare "$tmp/remote.git"
git init -q -b main "$tmp/repo"
cd "$tmp/repo"
git config user.email test@example.invalid
git config user.name test
git remote add origin "$tmp/remote.git"
mkdir -p .hooks
printf '#!/bin/sh\nsh %s/guard-commit.sh\n' "$hooks" >.hooks/pre-commit
printf '#!/bin/sh\nsh %s/commit-msg "$1"\n' "$hooks" >.hooks/commit-msg
chmod +x .hooks/*
commit "chore: bootstrap"
git push -q origin main
git switch -q -c develop
git push -q origin develop
git config core.hooksPath .hooks
# commit-msg calls the repository's own guard, so give the test repo one.
mkdir -p scripts/git-hooks && cp "$hooks/guard-commit.sh" scripts/git-hooks/

label="direct commit on develop is refused"; no commit "feat: x"
git switch -q main
label="direct commit on main is refused"; no commit "fix: x"

git switch -q -c feat/a develop
label="commit on a feature branch is allowed"; ok commit "feat: add a"
label="message outside Conventional Commits is refused"; no commit "added stuff"
label="feature branch name is accepted on push"; ok push feat/a feat/a
git push -q --no-verify origin feat/a
git branch -q wip
label="branch outside the pattern is refused on push"; no push wip wip

git switch -q develop
label="merge commit on develop is allowed"; ok git merge -q --no-ff feat/a -m "Merge branch 'feat/a' into develop"
label="push of develop reports develop"; ok sh -c "echo 'refs/heads/develop $(git rev-parse develop) refs/heads/develop $(git rev-parse origin/develop)' | sh '$hooks/guard-push.sh' | grep -qx develop"
git push -q --no-verify origin develop

git switch -q main
git merge -q --no-ff develop -m "release: v1.0.0"
label="main as a merge of origin/develop is allowed"; ok push main main

git reset -q --hard origin/main
git switch -q -c chore/x
commit "chore: x"
git switch -q main
git merge -q --no-ff chore/x -m "release: v1.0.1"
label="main as a merge of an unpushed branch is refused"; no push main main

git reset -q --hard origin/main
git switch -q -c hotfix/urgent
commit "fix: urgent"
git push -q --no-verify origin hotfix/urgent
git switch -q main
git merge -q --no-ff hotfix/urgent -m "release: v1.0.1"
label="main as a merge of a pushed origin/hotfix/* is allowed"; ok push main main

git push -q --no-verify origin main
git switch -q feat/a
git reset -q --hard HEAD~1
label="non-fast-forward push is refused"; no push feat/a feat/a

label="deleting develop is refused"; no delete develop
label="deleting main is refused"; no delete main

[ "$fails" -eq 0 ] && echo "guards: all passed" || { echo "guards: $fails failed" >&2; exit 1; }

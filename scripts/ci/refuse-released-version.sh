#!/bin/sh
# Fail closed on API/authentication errors, including when the release/tag lookup cannot complete.
set -eu
version=$(sh scripts/ci/release-version.sh)
tags=$(gh api --paginate "repos/$GITHUB_REPOSITORY/tags?per_page=100" --jq '.[].name')
releases=$(gh api --paginate "repos/$GITHUB_REPOSITORY/releases?per_page=100" --jq '.[].tag_name')
if printf '%s\n%s\n' "$tags" "$releases" | grep -Fxq "v$version"; then
  echo "release: v$version already exists; bump VERSION" >&2
  exit 1
fi

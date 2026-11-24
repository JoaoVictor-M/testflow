#!/bin/sh
# VERSION is also used in registry tags and API paths; reject anything outside stable SemVer.
set -eu
version=$(cat VERSION)
printf '%s\n' "$version" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' \
  || { echo 'release: VERSION must contain X.Y.Z' >&2; exit 1; }
[ "$(printf '%s' "$version" | wc -l)" -eq 0 ] || exit 1
printf '%s\n' "$version"

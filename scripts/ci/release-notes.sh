#!/bin/sh
# Extract one dated Keep a Changelog section, and refuse an absent or empty entry.
set -eu
version=$1
file=${2:-CHANGELOG.md}
notes=$(awk -v v="$version" '
  index($0, "## [" v "] - ") == 1 { on = 1; next }
  on && /^## \[/ { exit }
  on { print }
' "$file")
[ -n "$(printf '%s' "$notes" | tr -d '[:space:]')" ] \
  || { echo "release-notes: no notes for $version" >&2; exit 1; }
printf '%s\n' "$notes"

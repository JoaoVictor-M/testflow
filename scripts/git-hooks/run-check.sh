#!/bin/sh
# Runs "scripts/check.sh <target>" for a hook. Without check.sh the hook refuses instead of passing
# unchecked: a gate that is missing must never look green.
root=$(git rev-parse --show-toplevel)
if [ ! -x "$root/scripts/check.sh" ]; then
  echo "scripts/check.sh is missing or not executable: cannot run the '$1' check, refusing." >&2
  exit 1
fi
exec "$root/scripts/check.sh" "$1"

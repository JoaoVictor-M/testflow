#!/bin/sh
# Execute the deployment workflow's actual formatting step in a disposable destination.
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
destination=$1
mkdir -p "$destination/prod"
ln -s "$root" "$destination/source"
git init -q "$destination/prod"
awk '
  /^      - name: Format Prod Files$/ { step=1; next }
  step && /^      - name:/ { exit }
  step && /^        run: \|/ { script=1; next }
  script && /^          / { sub(/^          /, ""); print }
' "$root/.github/workflows/deploy-prod.yml" | sed \
  -e 's|${{ env.REGISTRY }}|${REGISTRY}|g' \
  -e 's|${{ env.IMAGE_OWNER }}|${IMAGE_OWNER}|g' \
  -e 's|${{ github.ref_name }}|${RELEASE_TAG}|g' >"$destination/format.sh"
(cd "$destination" && REGISTRY="${REGISTRY:-registry.example.test}" \
  IMAGE_OWNER="${IMAGE_OWNER:-testflow-fixture}" RELEASE_TAG=v0.0.0 bash -e format.sh)

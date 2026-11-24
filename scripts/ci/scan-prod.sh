#!/bin/sh
# Scan the exact archived images, without mounting the Docker socket into Trivy.
set -eu
: "${TRIVY_IMAGE:?}"
mkdir -p .cache/trivy reports/release-sbom
directory=$(mktemp -d "$PWD/.cache/testflow-release-scan.XXXXXX")
trap 'rm -rf "$directory"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
docker load -i prod-images.tar
for component in backend frontend nginx; do
  image="testflow-$component:prod"
  docker save -o "$directory/image.tar" "$image"
  # Preserve the previous production gate on ALL severities, including unfixed vulnerabilities.
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$directory:/images:ro" -v "$PWD/.cache/trivy:/cache" -v "$PWD/reports/release-sbom:/reports" \
    "$TRIVY_IMAGE" image --cache-dir /cache --input /images/image.tar --scanners vuln \
    --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --exit-code 1
  docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp \
    -v "$directory:/images:ro" -v "$PWD/.cache/trivy:/cache" -v "$PWD/reports/release-sbom:/reports" \
    "$TRIVY_IMAGE" image --cache-dir /cache --input /images/image.tar \
    --format spdx-json --output "/reports/testflow-$component.spdx.json"
done

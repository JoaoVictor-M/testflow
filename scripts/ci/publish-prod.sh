#!/bin/sh
# Load the scanned production images, push versioned tags, sign each immutable digest and only then
# promote latest. Any load, push, inspect or signature failure stops before latest is touched.
set -eu

: "${REGISTRY:?set REGISTRY}"
: "${GITHUB_REPOSITORY_OWNER:?set GITHUB_REPOSITORY_OWNER}"
: "${RELEASE_TAG:?set RELEASE_TAG}"
: "${GITHUB_SHA:?set GITHUB_SHA}"

docker load -i prod-images.tar
owner=$(printf '%s' "$GITHUB_REPOSITORY_OWNER" | tr 'A-Z' 'a-z')
image_registry="$REGISTRY/$owner"

for component in backend frontend nginx; do
  name="testflow-$component"
  for tag in "$RELEASE_TAG" "$GITHUB_SHA"; do
    docker tag "$name:prod" "$image_registry/$name:$tag"
    docker push "$image_registry/$name:$tag"
  done
  digest=$(docker image inspect --format '{{index .RepoDigests 0}}' "$image_registry/$name:$RELEASE_TAG")
  [ -n "$digest" ] || { echo "publish-prod: empty digest for $name:$RELEASE_TAG" >&2; exit 1; }
  cosign sign --yes "$digest"
done

for component in backend frontend nginx; do
  name="testflow-$component"
  docker tag "$name:prod" "$image_registry/$name:latest"
  docker push "$image_registry/$name:latest"
done

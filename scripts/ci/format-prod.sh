#!/bin/sh
# Format the production repository directory from the source checkout.
# Usage: REGISTRY=... IMAGE_OWNER=... RELEASE_TAG=... sh scripts/ci/format-prod.sh [source] [prod]
set -eu

source_dir=${1:-source}
prod_dir=${2:-prod}
: "${REGISTRY:?set REGISTRY}"
: "${IMAGE_OWNER:?set IMAGE_OWNER}"
: "${RELEASE_TAG:?set RELEASE_TAG}"

(cd "$prod_dir" && git rm -rf --ignore-unmatch .)

cp "$source_dir/mongo/mongo-init.js" "$prod_dir/mongo-init.js"
cp "$source_dir/.env.example" "$prod_dir/.env.example"
cp "$source_dir/README.md" "$prod_dir/README.md"
cp "$source_dir/LICENSE" "$prod_dir/LICENSE"
cp "$source_dir/SECURITY.md" "$prod_dir/SECURITY.md"
mkdir -p "$prod_dir/scripts"
cp -R "$source_dir/backup" "$prod_dir/backup"
cp "$source_dir/scripts/restore.sh" "$prod_dir/scripts/restore.sh"

# Remove a seção de desenvolvimento do README.md de produção usando sed delimitado.
sed -i '/## 🛠️ Desenvolvimento (Para Code Maintainers)/,/^---$/d' "$prod_dir/README.md"

printf '{"version": "%s"}\n' "$RELEASE_TAG" > "$prod_dir/version.json"

cp "$source_dir/docker-compose.yml" "$prod_dir/docker-compose.yml"
sed -i "s|build: ./testflow-app|image: ${REGISTRY}/${IMAGE_OWNER}/testflow-backend:${RELEASE_TAG}|g" "$prod_dir/docker-compose.yml"
sed -i "s|build: ./testflow-frontend|image: ${REGISTRY}/${IMAGE_OWNER}/testflow-frontend:${RELEASE_TAG}|g" "$prod_dir/docker-compose.yml"
sed -i "s|build: ./nginx|image: ${REGISTRY}/${IMAGE_OWNER}/testflow-nginx:${RELEASE_TAG}|g" "$prod_dir/docker-compose.yml"
sed -i "s|./mongo/mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro|./mongo-init.js:/docker-entrypoint-initdb.d/mongo-init.js:ro|g" "$prod_dir/docker-compose.yml"
sed -i '/mongodb-service:/,/volumes:/ { /ports:/d; /# dev-only-mongo-port/d }' "$prod_dir/docker-compose.yml"
sed -i '/container_name:/d' "$prod_dir/docker-compose.yml"

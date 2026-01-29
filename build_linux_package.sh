#!/bin/bash

# Create Linux Distribution Package
# Bundles only necessary files for production (no source code)

OUTPUT_DIR="installers"
PACKAGE_NAME="testflow-linux-v1.0.0.tar.gz"

mkdir -p $OUTPUT_DIR

echo "📦 Empacotando versão Linux..."

# Create a temporary directory for staging
STAGING_DIR="testflow-dist"
rm -rf $STAGING_DIR
mkdir -p $STAGING_DIR

# Copy required files
cp Makefile $STAGING_DIR/
cp docker-compose.prod.yml $STAGING_DIR/docker-compose.yml
cp mongo-init.js $STAGING_DIR/
mkdir -p $STAGING_DIR/config
cp config/testflow.service $STAGING_DIR/config/

# Create Tarball
tar -czf "$OUTPUT_DIR/$PACKAGE_NAME" -C . $STAGING_DIR

# Cleanup
rm -rf $STAGING_DIR

echo "✅ Pacote Linux criado: $OUTPUT_DIR/$PACKAGE_NAME"

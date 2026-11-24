#!/bin/sh
# Only these three images are distributed. No cache, development target, host env or test data.
set -eu
for component in backend frontend nginx; do
  case $component in
    backend) context=testflow-app ;;
    frontend) context=testflow-frontend ;;
    nginx) context=nginx ;;
  esac
  docker build --pull --no-cache -t "testflow-$component:prod" "$context"
  sh scripts/ci/check-prod-image.sh "testflow-$component:prod"
done

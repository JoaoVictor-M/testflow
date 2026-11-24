#!/bin/sh
# Invalid deployment origins must fail before touching nginx's runtime configuration.
set -eu
cd "$(dirname "$0")/.."
for origin in \
  'http://example.test' \
  'https://example.test/path' \
  'https://user@example.test' \
  'https://example.test;return 200;' \
  'https://example.test
return 200;' \
  'https://example.test:invalid'; do
  if output=$(NGINX_PUBLIC_ORIGIN="$origin" sh nginx/entrypoint.sh 2>&1); then
    echo 'FAIL - invalid public origin accepted' >&2
    exit 1
  fi
  case "$output" in
    NGINX_PUBLIC_ORIGIN*) ;;
    *) echo 'FAIL - invalid public origin reached nginx startup' >&2; exit 1 ;;
  esac
done
echo 'nginx entrypoint: invalid origins rejected before startup'

#!/bin/sh
# Test the same origin resolver used by the container entrypoint.
set -eu
cd "$(dirname "$0")/../.."
for origin in \
  'http://example.test' \
  'https://example.test/path' \
  'https://user@example.test' \
  'https://example.test;return 200;' \
  'https://example.test
return 200;' \
  'https://example.test:invalid' \
  'https://example.test:0' \
  'https://example.test:99999' \
  'https://example.test:65536' \
  'https://example..test' \
  'https://.example.test' \
  'https://example.test.' \
  'https://-example.test' \
  'https://a.-example.test' \
  'https://a.example-.test' \
  "https://$(printf '%064d' 0).test"; do
  if output=$(NGINX_PUBLIC_ORIGIN="$origin" FRONTEND_URL= sh nginx/public-origin.sh 2>&1); then
    echo 'FAIL - invalid public origin accepted' >&2
    exit 1
  fi
  case "$output" in
    NGINX_PUBLIC_ORIGIN*) ;;
    *) echo 'FAIL - invalid public origin reached nginx startup' >&2; exit 1 ;;
  esac
done
for origin in 'https://localhost' 'https://a-b.example.test:1' 'https://example.test:65535' \
  "https://$(printf '%063d' 0).test"; do
  output=$(NGINX_PUBLIC_ORIGIN="$origin" FRONTEND_URL= sh nginx/public-origin.sh)
  [ "$output" = "$origin" ] || exit 1
done
for frontend in 'https://frontend.example.test/testflow' 'https://frontend.example.test/?x=1' \
  'https://frontend.example.test#testflow'; do
  output=$(NGINX_PUBLIC_ORIGIN= FRONTEND_URL="$frontend" sh nginx/public-origin.sh)
  [ "$output" = 'https://frontend.example.test' ] || exit 1
done
for frontend in 'https://one.test,https://two.test' 'http://frontend.example.test' \
  'https://example..test/testflow'; do
  if NGINX_PUBLIC_ORIGIN= FRONTEND_URL="$frontend" sh nginx/public-origin.sh >/dev/null 2>&1; then
    echo 'FAIL - ambiguous or invalid FRONTEND_URL accepted' >&2
    exit 1
  fi
done
output=$(NGINX_PUBLIC_ORIGIN=https://explicit.test FRONTEND_URL='https://one.test,https://two.test' sh nginx/public-origin.sh)
[ "$output" = 'https://explicit.test' ]
echo 'nginx entrypoint: origins, labels, ports and FRONTEND_URL derivation passed'

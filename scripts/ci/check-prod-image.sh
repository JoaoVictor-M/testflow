#!/bin/sh
# Inspect without starting the image. Base-image certificates are allowed; application keys are not.
set -eu
image=$1
mkdir -p .cache
directory=$(mktemp -d "$PWD/.cache/testflow-inspect.XXXXXX")
container=
cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [ -n "$container" ]; then docker rm "$container" >/dev/null || result=1; fi
  rm -rf "$directory"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
workdir=$(docker image inspect --format '{{.Config.WorkingDir}}' "$image")
container=$(docker create --name "$(basename "$directory")" "$image" none)
docker export -o "$directory/image.tar" "$container"
tar -tf "$directory/image.tar" > "$directory/files"
awk -v workdir="${workdir#/}" '
  /(^|\/)\.git(\/|$)|(^|\/)\.env($|\.)/ { print; next }
  /\/node_modules\/(vitest|vite|typescript|c8|@playwright|nodemon)\// { print; next }
  /\/lib\/node_modules\/(npm|corepack)\// { print; next }
  {
    app = workdir == "" || index($0, workdir "/") == 1 || index($0, "usr/share/nginx/html/") == 1
    if (app && $0 !~ /\/(node_modules|site-packages|vendor)\// &&
      $0 ~ /\.map$|(^|\/)(seeds?|demo|fixtures?|e2e|__tests__|tests?)([.\/]|$)|[._](test|spec)\.[a-z]+$|\.(pem|key|p12|pfx)$/) print
  }
' "$directory/files" > "$directory/forbidden"
if [ -s "$directory/forbidden" ]; then
  echo "$image ships files forbidden in production:" >&2
  cat "$directory/forbidden" >&2
  exit 1
fi
echo "$image: production contents approved"

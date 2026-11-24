#!/bin/sh
# Functions shared by the targets that run against a disposable stack (full DAST, e2e, DAST baseline)
# and by their repository tests. The browser-facing targets set TESTFLOW_CI_OVERLAY to the Compose file
# that adds the frontend and nginx.
# GitHub Actions hides a value from its logs when told so; elsewhere the line would only be noise.
mask_secret() { [ -z "${GITHUB_ACTIONS:-}" ] || echo "::add-mask::$1"; }

prepare_ci_stack() {
  umask 077
  jwt_secret="$(openssl rand -hex 32)"
  mask_secret "$jwt_secret"
  printf '%s\n' \
    "MONGO_URI=mongodb://mongodb-service:27017/testflow" \
    "JWT_SECRET=$jwt_secret" \
    "PORT=3000" > "$TESTFLOW_CI_ENV"
  unset jwt_secret
}

ci_compose() {
  if [ -n "${TESTFLOW_CI_OVERLAY:-}" ]; then
    docker compose -p "$TESTFLOW_CI_PROJECT" -f docker-compose.ci.yml -f "$TESTFLOW_CI_OVERLAY" "$@"
  else
    docker compose -p "$TESTFLOW_CI_PROJECT" -f docker-compose.ci.yml "$@"
  fi
}

# The browser-facing stack: a throwaway self-signed certificate for nginx (HTTPS mode, as in production)
# and a random password for the seeded administrator, hashed by the backend image so that no hash or
# password lives in the repository. The container that drives the stack reads the plain password and the
# address from a private file inside the temporary directory.
prepare_ci_web() {
  mkdir "$ci_directory/tls"
  openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=nginx-service -addext subjectAltName=DNS:nginx-service \
    -keyout "$ci_directory/tls/testflow.key" -out "$ci_directory/tls/testflow.crt" 2>/dev/null
  # nginx runs as UID 101 and must read both files; they die with the directory.
  chmod 755 "$ci_directory/tls"
  chmod 644 "$ci_directory/tls/testflow.key" "$ci_directory/tls/testflow.crt"
  export TESTFLOW_CI_TLS="$ci_directory/tls"
  ci_admin_password="$(openssl rand -hex 16)"
  mask_secret "$ci_admin_password"
  ci_compose build backend-service
  TESTFLOW_ADMIN_PASSWORD_HASH=$(printf '%s' "$ci_admin_password" | ci_compose run --rm --no-deps -T backend-service \
    node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(require('bcryptjs').hashSync(s,10)))")
  export TESTFLOW_ADMIN_PASSWORD_HASH
  printf '%s\n' 'TESTFLOW_E2E_USER=admin' "TESTFLOW_E2E_PASSWORD=$ci_admin_password" \
    'TESTFLOW_E2E_URL=https://nginx-service:8443' > "$ci_directory/e2e.env"
  unset ci_admin_password
}

start_ci_stack() {
  if ! ci_compose up -d --build --wait --wait-timeout 180; then
    ci_compose logs backend-service mongodb-service
    return 1
  fi
}

close_ci_stack() {
  result=$?
  trap - EXIT INT TERM
  ci_compose down --remove-orphans || result=1
  rm -rf "$ci_directory"
  exit "$result"
}

# Starts an isolated Compose project with a fresh secret and removes it, with its secrets, on every exit.
open_ci_stack() {
  mkdir -p .cache reports
  ci_directory=$(mktemp -d "$PWD/.cache/testflow-ci.XXXXXX")
  export TESTFLOW_CI_ENV="$ci_directory/backend.env"
  export TESTFLOW_CI_PROJECT="testflow-ci-$(basename "$ci_directory" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n_-' '-')"
  trap close_ci_stack EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  prepare_ci_stack
  [ -z "${TESTFLOW_CI_OVERLAY:-}" ] || prepare_ci_web
  start_ci_stack
}

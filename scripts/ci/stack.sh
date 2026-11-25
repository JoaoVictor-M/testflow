#!/bin/sh
# Shared helpers for disposable stacks layered over docker-compose.yml + docker-compose.teste.yml.
# Callers set TESTFLOW_CI_SERVICES to the space-separated service list and TESTFLOW_CI_WEB=1 when
# the stack needs a throwaway HTTPS certificate and a seeded administrator.
mask_secret() { [ -z "${GITHUB_ACTIONS:-}" ] || echo "::add-mask::$1"; }

prepare_ci_stack() {
  umask 077
  jwt_secret="$(openssl rand -hex 32)"
  mask_secret "$jwt_secret"
  printf '%s\n' \
    "MONGO_URI=mongodb://mongodb-service:27017/testflow-db" \
    "JWT_SECRET=$jwt_secret" \
    "PORT=3000" > "$TESTFLOW_CI_ENV"
  unset jwt_secret
}

ci_compose() {
  docker compose --env-file /dev/null -p "$TESTFLOW_CI_PROJECT" \
    -f docker-compose.yml -f docker-compose.teste.yml "$@"
}

# Browser-facing stack: a throwaway self-signed certificate for nginx (HTTPS mode, as in production)
# and a random password for the seeded administrator hashed by the backend image.
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
  # shellcheck disable=SC2086 # TESTFLOW_CI_SERVICES is a list of Compose service names
  if ! ci_compose up -d --build --wait --wait-timeout 180 ${TESTFLOW_CI_SERVICES:-mongodb-service backend-service}; then
    # shellcheck disable=SC2086
    ci_compose logs ${TESTFLOW_CI_SERVICES:-mongodb-service backend-service}
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

# Starts an isolated Compose project per worktree/run and removes it, with its secrets, on every exit.
open_ci_stack() {
  mkdir -p .cache reports
  ci_directory=$(mktemp -d "$PWD/.cache/testflow-ci.XXXXXX")
  worktree=$(basename "$PWD" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n_-' '-')
  suffix=$(basename "$ci_directory" | tr 'A-Z' 'a-z' | tr -c 'a-z0-9\n_-' '-')
  export TESTFLOW_CI_ENV="$ci_directory/backend.env"
  export TESTFLOW_CI_PROJECT="testflow-ci-${worktree}-${suffix}"
  trap close_ci_stack EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  prepare_ci_stack
  [ -z "${TESTFLOW_CI_WEB:-}" ] || prepare_ci_web
  start_ci_stack
}

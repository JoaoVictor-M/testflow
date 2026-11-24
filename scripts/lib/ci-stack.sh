#!/bin/sh
# Functions shared by the full DAST runner and its repository tests.
prepare_ci_stack() {
  umask 077
  jwt_secret="$(openssl rand -hex 32)"
  echo "::add-mask::$jwt_secret"
  printf '%s\n' \
    "MONGO_URI=mongodb://mongodb-service:27017/testflow" \
    "JWT_SECRET=$jwt_secret" \
    "PORT=3000" > "$TESTFLOW_CI_ENV"
  unset jwt_secret
}

ci_compose() {
  docker compose -p "$TESTFLOW_CI_PROJECT" -f docker-compose.ci.yml "$@"
}

start_ci_stack() {
  if ! ci_compose up -d --build --wait --wait-timeout 180; then
    ci_compose logs backend-service
    return 1
  fi
}

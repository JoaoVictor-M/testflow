# The Node image of the quality gate plus the Docker CLI and the Compose plugin, for tests that run
# `docker compose config`. It never reaches a Docker daemon: no socket is mounted.
ARG NODE_IMAGE
FROM docker:cli@sha256:34507eb5069d8be82c95dd3b6987d4250fd5fee49b82e2509b7d7a7030740d6d AS docker

FROM ${NODE_IMAGE}
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose
USER node
HEALTHCHECK NONE

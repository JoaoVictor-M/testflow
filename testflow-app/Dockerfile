# Targets: `dev` (hot reload, development dependencies) and `prod` (the default, last stage).
FROM node:20.20.2-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS base
WORKDIR /app
# Keep all runtime packages current with the base distribution's security fixes.
RUN apk upgrade --no-cache
COPY package.json package-lock.json ./

FROM base AS dev
RUN npm ci --engine-strict && chown -R node:node /app
USER 1000:1000
EXPOSE 3000
# Healthy once /ready answers 200: the server is up and MongoDB responds.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "require('http').get({ host: '127.0.0.1', port: 3000, path: '/ready', timeout: 2500 }, (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1)).on('timeout', () => process.exit(1))"]
# The source is a bind mount; node --watch restarts the server when it changes.
CMD ["node", "--watch", "server.js"]

FROM base AS prod
# Install from the lock, then drop the package managers: nothing installs at runtime.
RUN npm ci --engine-strict --omit=dev && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --chown=node:node . .
# A bind mount keeps its own ownership; prepare existing storage before upgrading.
RUN mkdir -p /evidencias_testes && chown node:node /evidencias_testes /app
USER 1000:1000
EXPOSE 3000
# Healthy once /ready answers 200: the server is up and MongoDB responds.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "require('http').get({ host: '127.0.0.1', port: 3000, path: '/ready', timeout: 2500 }, (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1)).on('timeout', () => process.exit(1))"]
CMD [ "node", "index.js" ]

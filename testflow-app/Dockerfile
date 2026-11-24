FROM node:20-alpine
WORKDIR /app
# Keep all runtime packages current with the base distribution's security fixes.
RUN apk upgrade --no-cache
COPY package.json ./
# Force fresh install and explicit tar versioning
RUN rm -f package-lock.json && \
    npm install --omit=dev && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --chown=node:node . .
# A bind mount keeps its own ownership; prepare existing storage before upgrading.
RUN mkdir -p /evidencias_testes && chown node:node /evidencias_testes /app
USER 1000:1000
EXPOSE 3000
CMD [ "node", "index.js" ]

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# Force fresh install and explicit tar versioning
RUN rm -f package-lock.json && \
    npm install --omit=dev && \
    npm cache clean --force && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY . .
EXPOSE 3000
CMD [ "node", "index.js" ]
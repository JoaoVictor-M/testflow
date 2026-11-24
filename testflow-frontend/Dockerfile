# Targets: `dev` (Vite with hot reload) and `prod` (the default, last stage: static files behind nginx).
FROM node:20@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5 AS base
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

FROM base AS dev
EXPOSE 5173
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD ["node", "-e", "require('net').connect(5173, '127.0.0.1').on('connect', () => process.exit(0)).on('error', () => process.exit(1))"]
# The source is a bind mount; Vite reloads the browser when it changes.
CMD ["npx", "vite", "--host", "0.0.0.0"]

FROM base AS build
COPY --chown=node:node . .
RUN npm run build

FROM nginx:stable-alpine@sha256:8eb2b5540eae779603cc3db84b3986a15ecb5308b54303146eee9837c137b51a AS prod
# Keep distribution security fixes and prepare nginx's runtime directories.
RUN apk upgrade --no-cache && \
    rm /etc/nginx/conf.d/default.conf && \
    mkdir -p /usr/share/nginx/html/testflow && \
    sed -i '/^user /d; s|^pid .*;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /var/cache/nginx
COPY --from=build /app/dist /usr/share/nginx/html/testflow
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/testflow/"]
ENTRYPOINT ["nginx", "-g", "daemon off;"]

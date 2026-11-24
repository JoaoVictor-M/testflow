# ----- ESTÁGIO 1: Build -----
FROM node:20 AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# ----- ESTÁGIO 2: Serve -----
FROM nginx:stable-alpine
# Keep distribution security fixes and prepare nginx's runtime directories.
RUN apk upgrade --no-cache && \
    rm /etc/nginx/conf.d/default.conf && \
    mkdir -p /usr/share/nginx/html/testflow && \
    sed -i '/^user /d; s|^pid .*;|pid /tmp/nginx.pid;|' /etc/nginx/nginx.conf && \
    chown -R nginx:nginx /var/cache/nginx
COPY --from=build /app/dist /usr/share/nginx/html/testflow
# Copia o nosso config personalizado
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]

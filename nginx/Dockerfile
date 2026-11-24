FROM nginx:alpine

# Create directory for SSL certs
RUN apk upgrade --no-cache && \
    mkdir -p /etc/nginx/ssl && \
    chown -R nginx:nginx /var/cache/nginx

# Copy templates and entrypoint
COPY nginx-http.conf.template /etc/nginx/nginx-http.conf.template
COPY nginx-ssl.conf.template /etc/nginx/nginx-ssl.conf.template
COPY entrypoint.sh /etc/nginx/entrypoint.sh
COPY public-origin.sh /etc/nginx/public-origin.sh

RUN chmod +x /etc/nginx/entrypoint.sh /etc/nginx/public-origin.sh && \
    sed -i 's/\r$//' /etc/nginx/entrypoint.sh /etc/nginx/public-origin.sh
USER 101:101
EXPOSE 8080
EXPOSE 8443

ENTRYPOINT ["/etc/nginx/entrypoint.sh"]

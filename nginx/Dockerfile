FROM nginx:alpine@sha256:b50897d5c7b1aa08067c3d90c5e8b3e47ec4e3c91c91446f67820228f7b41e34

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
# Both modes listen on 8080 (HTTPS mode only redirects there), so check the port, not a page.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD ["nc", "-z", "127.0.0.1", "8080"]

ENTRYPOINT ["/etc/nginx/entrypoint.sh"]

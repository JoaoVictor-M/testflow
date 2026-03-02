FROM nginx:alpine

# Create directory for SSL certs
RUN mkdir -p /etc/nginx/ssl

# Copy templates and entrypoint
COPY nginx-http.conf.template /etc/nginx/nginx-http.conf.template
COPY nginx-ssl.conf.template /etc/nginx/nginx-ssl.conf.template
COPY entrypoint.sh /etc/nginx/entrypoint.sh

RUN chmod +x /etc/nginx/entrypoint.sh && sed -i 's/\r$//' /etc/nginx/entrypoint.sh
EXPOSE 80
EXPOSE 443

ENTRYPOINT ["/etc/nginx/entrypoint.sh"]

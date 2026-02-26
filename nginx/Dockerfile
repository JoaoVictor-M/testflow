FROM nginx:alpine

# Install openssl to generate self-signed certificates inside the container
RUN apk add --no-cache openssl

# Create directory for SSL certs
RUN mkdir -p /etc/nginx/ssl

# Generate a self-signed certificate for local testing
# In production, IT will provide proper certs which can be mounted as volumes over this folder
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/testflow.key \
    -out /etc/nginx/ssl/testflow.crt \
    -subj "/C=BR/ST=SP/L=Sao Paulo/O=TestFlow/CN=localhost"

# Copy the config file
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]

#!/bin/sh
set -eu

# Only deployment configuration supplies absolute redirect origins.
NGINX_PUBLIC_ORIGIN=$(sh /etc/nginx/public-origin.sh)

# Diretório onde os certificados devem estar
CERT_DIR="/etc/nginx/ssl"

echo "Iniciando Nginx Entrypoint..."

# Encontra o primeiro arquivo .crt e .key na pasta
if [ -d "$CERT_DIR" ] && { [ ! -r "$CERT_DIR" ] || [ ! -x "$CERT_DIR" ]; }; then
    echo 'TLS certificate directory must be readable and searchable by nginx (GID 101).' >&2
    exit 1
fi
CERT_CRT=
CERT_KEY=
for candidate in "$CERT_DIR"/*.crt; do [ ! -e "$candidate" ] || { CERT_CRT=$candidate; break; }; done
for candidate in "$CERT_DIR"/*.key; do [ ! -e "$candidate" ] || { CERT_KEY=$candidate; break; }; done

if [ -n "$CERT_CRT" ] || [ -n "$CERT_KEY" ]; then
    if [ -z "$CERT_CRT" ] || [ -z "$CERT_KEY" ]; then
        echo 'TLS requires both a .crt certificate and a .key private key.' >&2
        exit 1
    fi
    if [ ! -r "$CERT_CRT" ] || [ ! -r "$CERT_KEY" ]; then
        echo 'TLS certificate and private key must be readable by nginx (GID 101); migrate root:root 0600 files to root:101 0640.' >&2
        exit 1
    fi
fi

if [ -n "$CERT_CRT" ] && [ -n "$CERT_KEY" ]; then
    echo "Certificados SSL encontrados (HTTPS ativado)."
    
    # Substitui os nomes dos certificados no arquivo de configuração do Nginx pelo que foi encontrado
    sed -e "s|ssl_certificate /etc/nginx/ssl/testflow.crt;|ssl_certificate $CERT_CRT;|" \
        -e "s|ssl_certificate_key /etc/nginx/ssl/testflow.key;|ssl_certificate_key $CERT_KEY;|" \
        -e "s|__PUBLIC_ORIGIN__|$NGINX_PUBLIC_ORIGIN|g" \
        /etc/nginx/nginx-ssl.conf.template > /tmp/testflow-nginx.conf
else
    echo "Certificados SSL (.crt e .key) NÃO encontrados em $CERT_DIR."
    echo "Iniciando Nginx no modo fallback (HTTP)."
    cp /etc/nginx/nginx-http.conf.template /tmp/testflow-nginx.conf
fi

exec nginx -c /tmp/testflow-nginx.conf -g "daemon off;"

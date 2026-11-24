#!/bin/sh
set -eu

# This deployment setting is the only source for absolute redirects.
NGINX_PUBLIC_ORIGIN=${NGINX_PUBLIC_ORIGIN:-https://localhost}
case "$NGINX_PUBLIC_ORIGIN" in
    *[!a-zA-Z0-9.:/-]*)
        echo 'NGINX_PUBLIC_ORIGIN contains unsupported characters.' >&2
        exit 1
        ;;
esac
if ! printf '%s\n' "$NGINX_PUBLIC_ORIGIN" | grep -Eq '^https://[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?(:[0-9]{1,5})?$'; then
    echo 'NGINX_PUBLIC_ORIGIN must be an HTTPS origin with a hostname and optional port.' >&2
    exit 1
fi

# Diretório onde os certificados devem estar
CERT_DIR="/etc/nginx/ssl"

echo "Iniciando Nginx Entrypoint..."

# Encontra o primeiro arquivo .crt e .key na pasta
CERT_CRT=$(ls "$CERT_DIR"/*.crt 2>/dev/null | head -n 1)
CERT_KEY=$(ls "$CERT_DIR"/*.key 2>/dev/null | head -n 1)

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

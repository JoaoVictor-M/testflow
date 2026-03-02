#!/bin/sh

# Diretório onde os certificados devem estar
CERT_DIR="/etc/nginx/ssl"

echo "Iniciando Nginx Entrypoint..."

# Encontra o primeiro arquivo .crt e .key na pasta
CERT_CRT=$(ls "$CERT_DIR"/*.crt 2>/dev/null | head -n 1)
CERT_KEY=$(ls "$CERT_DIR"/*.key 2>/dev/null | head -n 1)

if [ -n "$CERT_CRT" ] && [ -n "$CERT_KEY" ]; then
    echo "Certificados SSL encontrados (HTTPS ativado)."
    echo "Certificado: $CERT_CRT"
    echo "Chave: $CERT_KEY"
    
    # Substitui os nomes dos certificados no arquivo de configuração do Nginx pelo que foi encontrado
    sed -e "s|ssl_certificate /etc/nginx/ssl/testflow.crt;|ssl_certificate $CERT_CRT;|" \
        -e "s|ssl_certificate_key /etc/nginx/ssl/testflow.key;|ssl_certificate_key $CERT_KEY;|" \
        /etc/nginx/nginx-ssl.conf.template > /etc/nginx/nginx.conf
else
    echo "Certificados SSL (.crt e .key) NÃO encontrados em $CERT_DIR."
    echo "Iniciando Nginx no modo fallback (HTTP)."
    cp /etc/nginx/nginx-http.conf.template /etc/nginx/nginx.conf
fi

exec nginx -g "daemon off;"

#!/bin/sh
set -eu

invalid_origin() {
    echo 'NGINX_PUBLIC_ORIGIN must be an HTTPS origin with valid hostname labels and a port from 1 to 65535.' >&2
    exit 1
}

origin=${NGINX_PUBLIC_ORIGIN:-}
if [ -z "$origin" ]; then
    frontend=${FRONTEND_URL:-https://localhost/testflow}
    case "$frontend" in
        *[[:space:],]*) invalid_origin ;;
        https://*) authority=${frontend#https://}; authority=${authority%%[/?#]*}; origin="https://$authority" ;;
        *) invalid_origin ;;
    esac
fi

case "$origin" in https://*) authority=${origin#https://} ;; *) invalid_origin ;; esac
case "$authority" in ''|*[!a-zA-Z0-9.:-]*) invalid_origin ;; esac
public_hostname=${authority%%:*}
case "$authority" in
    *:*)
        port=${authority#*:}
        case "$port" in ''|*[!0-9]*) invalid_origin ;; esac
        [ "${#port}" -le 5 ] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || invalid_origin
        ;;
esac
case "$public_hostname" in ''|.*|*.|*..*) invalid_origin ;; esac
[ "${#public_hostname}" -le 253 ] || invalid_origin
old_ifs=$IFS
IFS=.
# Splitting is intentional; the allowed hostname characters cannot expand globs.
set -- $public_hostname
IFS=$old_ifs
for label do
    case "$label" in ''|-*|*-) invalid_origin ;; esac
    [ "${#label}" -le 63 ] || invalid_origin
done
printf '%s\n' "$origin"

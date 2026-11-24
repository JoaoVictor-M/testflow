# Backup and restore tools: mongodump/mongorestore, tar and age. Runs as a regular user; the compose
# service and scripts/restore.sh add the read-only root file system and drop every capability.
FROM alpine:3.21@sha256:bc21487101ae47172509130ee1092cc273a831968d64b617776d1f69c81e42ab
RUN apk add --no-cache age=1.2.1-r5 mongodb-tools=100.9.4-r10 tar=1.35-r2
COPY --chmod=755 backup.sh restore.sh /usr/local/bin/
USER 1000:1000
HEALTHCHECK NONE
ENTRYPOINT ["backup.sh"]

FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# Force fresh install and explicit tar versioning
RUN npm install -g npm@latest && \
    rm -f package-lock.json && \
    npm install && \
    npm uninstall tar && \
    npm install tar@7.5.7 --save-exact && \
    npm list tar || true
COPY . .
EXPOSE 3000
CMD [ "node", "index.js" ]
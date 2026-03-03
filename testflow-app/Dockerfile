FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# Force fresh install and explicit tar versioning
RUN npm install -g npm@latest && \
    rm -f package-lock.json && \
    npm install --omit=dev
COPY . .
EXPOSE 3000
CMD [ "node", "index.js" ]
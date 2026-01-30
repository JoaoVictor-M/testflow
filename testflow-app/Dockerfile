FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install -g npm@latest && rm -f package-lock.json && npm install
COPY . .
EXPOSE 3000
USER node
CMD [ "node", "index.js" ]
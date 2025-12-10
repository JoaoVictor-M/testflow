# ----- ESTÁGIO 1: Build -----
FROM node:20 AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# ----- ESTÁGIO 2: Serve -----
FROM nginx:stable-alpine
# Remove o config padrão
RUN rm /etc/nginx/conf.d/default.conf
# Copia os arquivos do React
COPY --from=build /app/dist /usr/share/nginx/html
# Copia o nosso config personalizado
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
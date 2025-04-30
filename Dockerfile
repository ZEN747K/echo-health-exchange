
FROM node:18-alpine as build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove any potential default index.html from nginx image
RUN rm -rf /usr/share/nginx/html/index.html.default

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

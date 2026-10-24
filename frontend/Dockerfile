# 多阶段构建：Node 阶段用 npm 构建 React，运行阶段只留 nginx + 静态产物，镜像小且无 Node 运行时
FROM node:24-alpine AS build
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 80

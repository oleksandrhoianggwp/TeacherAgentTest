# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY tsconfig.base.json tsconfig.base.json
RUN npm ci

COPY server server
RUN npm -w server run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json server/package.json
RUN npm ci --omit=dev

COPY --from=build /app/server/dist server/dist

EXPOSE 3000
CMD ["node", "server/dist/index.js"]


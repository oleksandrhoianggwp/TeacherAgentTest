# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY agent/package.json agent/package.json
COPY tsconfig.base.json tsconfig.base.json
RUN npm ci

COPY agent agent
RUN npm -w agent run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY agent/package.json agent/package.json
RUN npm ci --omit=dev

COPY --from=build /app/agent/dist agent/dist

EXPOSE 3001
CMD ["node", "agent/dist/index.js"]


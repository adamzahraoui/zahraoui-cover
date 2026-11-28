# syntax=docker/dockerfile:1
FROM node:24.22.3-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS node-base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

FROM node:24.22.3-bookworm-slim@sha256:873f586f3794f52281bd039bf02c048a0be08fde619338f9941bad1eb6b34530 AS frontend-build
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --no-audit
COPY frontend/ ./
RUN NODE_ENV=production npm run build

FROM node-base AS backend-build
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci --no-audit
COPY backend/ ./
RUN npm run build

FROM node-base AS runtime-deps
WORKDIR /build/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --omit=optional --no-audit
COPY --from=backend-build /build/backend/node_modules/.prisma ./node_modules/.prisma
RUN chmod -R a+rX node_modules/.prisma

FROM backend-build AS migration-deps
RUN npm prune --omit=dev --no-audit && rm -rf node_modules/.cache

FROM node-base AS backend-files
WORKDIR /app/backend
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/* \
    && rm -rf /usr/local/lib/node_modules /opt/yarn-v* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=backend-build /build/backend/package.json ./
COPY --from=backend-build /build/backend/dist ./dist
USER node

FROM backend-files AS backend
USER root
RUN install -d -m 0700 -o node -g node /private-documents
COPY --from=runtime-deps /build/backend/node_modules ./node_modules
COPY --from=frontend-build /build/frontend/dist /app/frontend
COPY docker/staging/worker-health.mjs docker/staging/check-documents.mjs ./
USER node
CMD ["node", "dist/src/server.js"]

FROM backend-files AS migration
COPY --from=migration-deps /build/backend/node_modules ./node_modules
COPY --from=backend-build /build/backend/prisma ./prisma
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM nginx/nginx-unprivileged:1.30.8-alpine@sha256:637c35e46af7bc0dd3d3bcf7162e004e13ab3b370fde7cd416e2ac410b5a985a AS proxy
USER root
RUN apk upgrade --no-cache
COPY docker/staging/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /build/frontend/dist/assets /srv/frontend/assets
USER 101

FROM postgres:18-alpine@sha256:0115267ab5a509022df9319c77be365cef335adb71556c75f60f5360ee247e71 AS postgres
# Compose and the image both run as postgres, so the root-only switch helper is unused.
RUN apk upgrade --no-cache && rm /usr/local/bin/gosu
USER postgres

FROM axllent/mailpit:v1.34.0@sha256:23a2ef85bc50853ab3093645d1d64679afd8887e89da5e48a88940c172591a4e AS mailpit
RUN apk upgrade --no-cache
USER 65532:65532

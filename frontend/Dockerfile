# syntax=docker/dockerfile:1
#
# Frontend image: React app built by Vite, served as static files by nginx.
# Build from the REPO ROOT, the npm workspace lockfile lives there:
#   docker build -f frontend/Dockerfile -t conduit-frontend .

ARG NODE_IMAGE=node:24-alpine3.23
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30-alpine

# ---- build: install frontend workspace deps (incl. dev, Vite is needed) and build ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace frontend --no-audit --no-fund

COPY frontend/ ./frontend/
RUN npm run build --workspace frontend

# ---- runtime: only the static files + nginx, no Node.js at all ----
FROM ${NGINX_IMAGE} AS runtime

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

# Base image already runs as non-root (uid 101) and listens on an unprivileged port.
USER 101
EXPOSE 8080

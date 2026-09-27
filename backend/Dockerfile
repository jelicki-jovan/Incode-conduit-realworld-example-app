# syntax=docker/dockerfile:1
#
# Backend API image (Express + Sequelize).
# Build from the REPO ROOT, the npm workspace lockfile lives there:
#   docker build -f backend/Dockerfile -t conduit-backend .

ARG NODE_IMAGE=node:24-alpine3.23

# ---- deps: install production dependencies of the backend workspace only ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# Manifests first, so this layer is cached until dependencies change.
# frontend/package.json is needed because the root lockfile references both workspaces.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

RUN --mount=type=cache,target=/root/.npm \
    npm ci --workspace backend --omit=dev --no-audit --no-fund

# ---- runtime ----
FROM ${NODE_IMAGE} AS runtime

# tini runs as PID 1: forwards SIGTERM to node and reaps zombies,
# so Kubernetes rollouts stop the container gracefully instead of waiting for SIGKILL.
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3001

# RDS CA bundle (public) for verifying the database's TLS certificate (PROD_DB_SSL_CA).
# Pinned by checksum: if AWS updates the bundle, the build fails until the checksum is bumped.
# Directory created first: ADD from a URL would create it root-only, unreadable for the app user.
RUN mkdir -m 0755 -p /app/certs
ADD --checksum=sha256:b1711d12bae51838581281e23b6cb97b1074016873b4dafc80ed14002462dd77 --chmod=644 \
    https://truststore.pki.rds.amazonaws.com/us-east-1/us-east-1-bundle.pem /app/certs/rds-us-east-1.pem

WORKDIR /app
COPY --from=deps --chown=root:root /app/node_modules ./node_modules
COPY --chown=root:root package.json ./
COPY --chown=root:root backend/ ./backend/

# App files are owned by root and read-only for the runtime user.
# Numeric UID lets Kubernetes verify runAsNonRoot.
USER 1000:1000
WORKDIR /app/backend

EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "index.js"]

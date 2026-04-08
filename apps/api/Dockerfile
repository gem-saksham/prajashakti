# ─── Stage 1: Install all dependencies ──────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --workspace=apps/api --workspace=packages/shared --include-workspace-root

# ─── Stage 2: Production image ───────────────────────────────────────────────
FROM node:20-alpine AS runner

# curl for health check
RUN apk add --no-cache curl

WORKDIR /app

# Non-root user
RUN addgroup -S prajashakti && adduser -S api -G prajashakti

# Copy workspace resolution metadata
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api/src ./apps/api/src
COPY apps/api/package.json ./apps/api/

# Own everything as the app user
RUN chown -R api:prajashakti /app

USER api

WORKDIR /app/apps/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]

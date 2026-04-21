# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=packages/core --workspace=apps/api

# Copy source
COPY packages/core/ ./packages/core/
COPY apps/api/ ./apps/api/
COPY tsconfig.base.json ./

# Build shared core then API
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/api

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Only install production dependencies
COPY package.json package-lock.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/

RUN npm ci --omit=dev --workspace=packages/core --workspace=apps/api

# Copy compiled output
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy DB schema and migrations (needed at runtime)
COPY apps/api/src/db/schema.sql ./apps/api/src/db/schema.sql

EXPOSE 8080

ENV PORT=8080

CMD ["node", "apps/api/dist/index.js"]

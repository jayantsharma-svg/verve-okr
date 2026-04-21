# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json turbo.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=packages/core --workspace=apps/web

# Copy source
COPY packages/core/ ./packages/core/
COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

# Build args for public env vars baked into the bundle at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build shared core then web app
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/web

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Next.js standalone output bundles everything needed
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
RUN mkdir -p ./apps/web/public

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# Copy top-level manifests for workspace install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Copy the web app manifest and any shared package manifests as needed
COPY apps/web/package.json apps/web/
# If you have workspace packages, copy their manifests for better caching
# COPY packages/*/package.json packages/*/

RUN pnpm install --frozen-lockfile

# Copy repository source for build
COPY . .
WORKDIR /app/apps/web

# Ensure Next.js standalone output (configure in next.config.js)
RUN pnpm build

# ---- Runtime stage ----
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone server output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./.next/static
COPY --from=builder /app/apps/web/public ./public

EXPOSE 3000
CMD ["node", "server.js"]

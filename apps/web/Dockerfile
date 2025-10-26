# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

# Copy top-level manifests for workspace install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
# Copy workspace manifests referenced by the lockfile before installing
COPY apps/*/package.json apps/*/
COPY packages/*/package.json packages/*/
COPY db/*/package.json db/*/

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

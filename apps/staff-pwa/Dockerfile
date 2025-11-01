# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=20.19.1
ARG PNPM_VERSION=8.15.4

FROM node:${NODE_VERSION}-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /workspace

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/*/package.json packages/*/package.json
COPY apps/pwa/package.json apps/pwa/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
RUN pnpm --filter @apps/pwa run build

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN apk add --no-cache curl \
  && addgroup -S nextjs \
  && adduser -S nextjs -G nextjs

COPY --from=build /workspace/apps/pwa/.next/standalone ./
COPY --from=build /workspace/apps/pwa/.next/static ./apps/pwa/.next/static
COPY --from=build /workspace/apps/pwa/public ./apps/pwa/public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fsS http://127.0.0.1:3000/ || exit 1

CMD ["node", "apps/pwa/server.js"]

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
COPY apps/api/package.json apps/api/package.json
COPY packages/*/package.json packages/*/package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
WORKDIR /workspace
COPY --from=deps /workspace/node_modules ./node_modules
COPY . .
RUN pnpm --filter @apps/api run build

FROM build AS prod-deps
RUN pnpm prune --prod --filter @apps/api...

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /srv/app
RUN apk add --no-cache curl \
  && addgroup -S api \
  && adduser -S api -G api

COPY --from=prod-deps /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./dist
COPY --from=build /workspace/apps/api/package.json ./package.json

USER api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -fsS http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "dist/server.js"]

# Local hosting guide

This document explains how to run the Avocat-AI stack entirely on a local MacBook without relying on managed cloud runtimes. The goal is to keep the operator console (PWA) and API ready for future reverse proxies while preserving the Supabase backend.

## Prerequisites

- macOS with Node.js 20.x (`asdf install nodejs 20`, `fnm use 20`, or `nvm use 20`).
- PNPM 8.15.4 (`corepack enable pnpm`).
- Docker (optional) if you prefer running Supabase locally; otherwise point to a hosted Supabase project.
- Supabase project with the `authorities`, `uploads`, and `snapshots` buckets plus `pgvector` and `pg_trgm` extensions.

## Environment files

1. Copy `.env.example` to `.env.local` at the repository root.
2. Fill in the required secrets:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`.
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (these are safe for the browser bundle).
   - `OPENAI_API_KEY`, `AGENT_MODEL`, `EMBEDDING_MODEL`, `SUMMARISER_MODEL`.
   - `APP_ENV=local`, `PORT=3000` (override as needed).
3. Never commit `.env.local`. For shared defaults, update `.env.example` only with placeholder values.

## Install dependencies

```bash
pnpm install
```

This installs workspaces for API (`apps/api`), web (`apps/web`), ops tooling (`apps/ops`), Supabase edge functions, and shared packages. If you encounter native module rebuild errors, ensure Xcode Command Line Tools are installed (`xcode-select --install`).

## Build and validate

```bash
pnpm typecheck
pnpm lint
pnpm build
```

- `pnpm typecheck` runs TypeScript across all packages.
- `pnpm lint` enforces ESLint rules (strict, zero warnings).
- `pnpm build` compiles the API, web app (Next.js standalone output), PWA service worker, and ops CLIs.

## Start services locally

### API

```bash
pnpm dev:api
```

The Fastify server listens on `http://localhost:3333` by default. Update `APPS_API_PORT` in the relevant config if needed.

### Web / PWA

For development with hot reload:

```bash
pnpm dev:web
```

For a production-like run after `pnpm build`:

```bash
pnpm start
```

`pnpm start` proxies to `next start -p ${PORT:-3000}` within `apps/web`, matching the configuration used behind a reverse proxy.

### Ops tooling

Automation commands (migrations, RLS smoke tests, ingestion) live in `apps/ops`.

```bash
pnpm ops:foundation
pnpm --filter @apps/ops rls-smoke
```

These commands ensure Supabase tables, buckets, and extensions are aligned before exposing the stack to users.

## Cron and background jobs

Managed cron was previously configured via the hosted provider. For local hosting:

- Use `node` + `cron` packages or macOS `launchd` to schedule CLI invocations.
- See [../scripts/cron.md](../scripts/cron.md) for notes and TODO items while we design the replacement scheduler.

## Reverse proxy / TLS (future work)

When you are ready to expose the admin UI beyond localhost:

1. Place a reverse proxy (Caddy, nginx, Traefik) in front of the Next.js server.
2. Terminate TLS at the proxy.
3. Add HTTP basic auth or SSO at the proxy level until application-level auth is finalised.
4. Forward `/api/*` routes to the Fastify server if hosting API and web separately.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `pnpm build` fails looking for `next start -p` | Outdated build artifacts | Run `pnpm --filter @avocat-ai/web clean` then retry `pnpm build`. |
| 500 errors from Supabase actions | Missing service role key or RLS policies | Re-check `.env.local` values and rerun `pnpm ops:foundation`. |
| PWA assets missing icons | `icons:generate` not executed | Run `pnpm --filter @avocat-ai/web icons:generate` before build. |
| API rejects OpenAI calls in production mode | Placeholder OpenAI keys | Replace with real keys; see `.env.example` for required values. |

## What changed compared to the hosted deployment?

- Removed every package and config tied to the previous hosted provider, including analytics adapters and preview workflows.
- Standardised on Node.js runtime with `next start -p ${PORT:-3000}`.
- Added `.github/workflows/node.yml` for consistent pnpm CI gates.
- Documented local cron expectations in `scripts/cron.md`.

Track additional TODOs in `docs/audit/2025-02-22_taskboard.md` under the deployment readiness epic.

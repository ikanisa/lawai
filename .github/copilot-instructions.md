# Copilot Instructions for Avocat-AI Francophone Monorepo

## Repository Overview

**Large-scale production legal AI monorepo** (~1300 TS/JS files, 21 packages) with PNPM 8.15.4 workspaces, Node.js 20 (`.nvmrc`).

**Stack:** TypeScript, Fastify, Next.js 14, Supabase (Postgres), OpenAI Agents SDK, Deno (Edge), Vitest, Playwright

**Structure:**
- `apps/api/` - Fastify REST API (port 3333), agent orchestrator
- `apps/web/` - Next.js operator console (port 3001), shadcn/ui
- `apps/pwa/` - Next.js public PWA (port 3000), Radix UI
- `apps/ops/` - CLI: migrations, provisioning, evaluations
- `apps/edge/` - 20+ Supabase Edge Functions (Deno)
- `packages/shared/` - Schemas, constants, IRAC definitions
- `packages/supabase/` - Generated Supabase types
- `db/migrations/` - 107+ SQL migrations (**canonical**, NOT `supabase/migrations/`)

## Build & Environment Setup

### Initial Setup (REQUIRED sequence)

```bash
# 1. Enable pnpm (REQUIRED)
corepack enable && corepack prepare pnpm@8.15.4 --activate

# 2. Install (use --no-frozen-lockfile locally, --ignore-scripts if Cypress fails)
pnpm install --no-frozen-lockfile
# or: pnpm install --no-frozen-lockfile --ignore-scripts
```

**Known Issues:**
- Cypress download fails in restricted networks (non-blocking)
- Lockfile out of sync with `apps/edge/package.json` (use `--no-frozen-lockfile`)

### Environment Variables

Copy `.env.example` to `.env.local`. **Production rejects placeholders:**
- `SUPABASE_URL` (no `localhost`/`example.supabase.co`)
- `OPENAI_API_KEY` (no `sk-test-`/`sk-demo-`/`sk-placeholder-`)
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` (for migrations)
- Front-end: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`

See `.env.example` and `docs/env-matrix.md`.

## Build, Lint, Test Commands

```bash
# Typecheck (fails in observability - OpenTelemetry version conflict, KNOWN)
pnpm typecheck
pnpm --filter @apps/api typecheck  # workspace-specific works

# Lint (fails in compliance - missing ESLint config, KNOWN)
pnpm lint
pnpm --filter @apps/api lint  # workspace-specific works

# Test (some fail on fresh clone - expected)
pnpm test
pnpm --filter @apps/api test

# Build (API has observability type errors - KNOWN)
pnpm build
pnpm --filter @avocat-ai/web build
```

### Pre-Commit Checks (REQUIRED before PR)

```bash
# CRITICAL: Migrations check (REQUIRES flag for 14 legacy files)
ALLOW_SUPABASE_MIGRATIONS=1 pnpm check:migrations

# CRITICAL: Binary assets (MUST pass, PR auto-rejects PNG/PDF/ZIP/etc.)
pnpm check:binaries

# SQL lint, env validation
pnpm lint:sql
pnpm env:validate
```

**Migration Rules:**
- New migrations: `db/migrations/YYYYMMDDHHMMSS_slug.sql` (NOT `supabase/migrations/`)
- After creating: `node scripts/generate-migration-manifest.mjs`
- Rollback strategies: `manual-restore`, `reapply-migration`, `reseed`

### Development Servers

```bash
pnpm dev:api  # Fastify API (port 3333)
pnpm dev:web  # Operator console (port 3001)
pnpm --filter @apps/pwa dev  # Public PWA (port 3000)
```

**NOTE:** `apps/web` pre-build hooks generate icons/service workers (usually self-resolving on rebuild).

### Ops Commands (require Supabase)

```bash
pnpm db:migrate  # Apply migrations
pnpm ops:foundation  # Full setup: migrations + buckets + vector store
pnpm ops:provision  # Provision environment
pnpm ops:check  # Health check
pnpm ops:evaluate --org <uuid> --user <uuid>  # Evaluations
```

## Known Issues & Workarounds

1. **API TypeScript errors** - Missing observability types. Use `pnpm dev:api` (tsx is lenient). Expected.
2. **Observability typecheck fails** - MetricReader version mismatch. Ignore or skip. Expected.
3. **Compliance lint fails** - Missing ESLint config. Skip or add `.eslintrc.cjs`. Expected.
4. **Edge functions skip checks** - "Deno not installed". Optional, set `DENO_BIN` if needed. Expected.
5. **Lockfile out of sync** - Use `--no-frozen-lockfile` locally. Expected.

## Project Layout & Key Files

**Root:** `package.json` (pnpm@8.15.4, Node 20), `pnpm-workspace.yaml`, `tsconfig.base.json`, `.nvmrc`, `.lefthook.yml`

**CI/CD (`.github/workflows/`):**
- `ci.yml` - Main CI (main/master): typecheck → lint → test → build
- `monorepo-ci.yml` - Full CI (work branch) with migration checks
- Required checks: lint, typecheck, test, `ALLOW_SUPABASE_MIGRATIONS=1 check:migrations`, `check:binaries`

**Scripts (`scripts/`):**
- `check-migrations.mjs` - Validate naming, manifest, checksums
- `check-binaries.mjs` - Block binary assets
- `deployment-preflight.mjs` - Production validation
- `generate-migration-manifest.mjs` - Update `db/migrations/manifest.json`

**Database:**
- `db/migrations/` - **CANONICAL** (107+ files, format: `YYYYMMDDHHMMSS_slug.sql`)
- `db/migrations/manifest.json` - Auto-generated (DO NOT edit)
- `supabase/migrations/` - Legacy (14 files, READ-ONLY)

**Docs:** `README.md`, `CONTRIBUTING.md`, `docs/env-matrix.md`, `docs/troubleshooting_network.md`, `docs/operations/`, `docs/governance/`

## Architecture

**API (`apps/api/`):** Fastify + OpenAI Agents SDK. Routes: `/runs`, `/corpus`, `/matters`, `/agents`, `/hitl`, `/admin/*`, `/realtime`, `/voice`. Admin panel: `FEAT_ADMIN_PANEL` flag (default enabled dev/preview). Rejects placeholder secrets in production.

**Web (`apps/web/`):** Next.js 14 + shadcn/ui. Pre-build: icon gen, service worker prep. Playwright E2E tests. Dashboard badges via `NEXT_PUBLIC_*` env vars.

**PWA (`apps/pwa/`):** Next.js 14 + Radix UI. Cypress E2E (may fail install). Service worker support.

**Ops (`apps/ops/`):** TypeScript CLI (tsx). Commands: `migrate`, `provision`, `foundation`, `evaluate`, `red-team`, `transparency`, `slo`, `learning`.

**Edge (`apps/edge/`):** 20+ Deno functions. Cron: `supabase/config.toml`. Deploy: `supabase functions deploy <name>`. Needs `EDGE_SERVICE_SECRET`.

**Packages:** `@avocat-ai/shared` (schemas), `@avocat-ai/supabase` (types), `@avocat-ai/compliance`, `@avocat-ai/observability` (type issues)

## Best Practices

1. **Use pnpm 8.15.4** via corepack, not npm/yarn
2. **Use `--no-frozen-lockfile` locally** (lockfile sync issues expected)
3. **Set `ALLOW_SUPABASE_MIGRATIONS=1`** for migration checks
4. **Run `check:binaries` before committing** (binary assets block PRs)
5. **Use `.env.local`, never commit secrets**
6. **Use `pnpm --filter <workspace>`** for targeted ops
7. **Ignore observability typecheck failures** (known OpenTelemetry conflict)
8. **Skip compliance linting** (missing config expected)
9. **Don't fix unrelated test failures** (missing runtime deps)
10. **Follow Conventional Commits** (governance requirement)

## Quick Reference

**Setup:**
```bash
corepack enable && corepack prepare pnpm@8.15.4 --activate
pnpm install --no-frozen-lockfile
cp .env.example .env.local
```

**Pre-Commit:**
```bash
ALLOW_SUPABASE_MIGRATIONS=1 pnpm check:migrations
pnpm check:binaries
pnpm lint  # workspace-specific if monorepo fails
pnpm typecheck  # workspace-specific if monorepo fails
```

**Dev:**
```bash
pnpm dev:api  # Start API
pnpm dev:web  # Start console
pnpm --filter @apps/api test  # Test workspace
pnpm --filter @avocat-ai/web build  # Build workspace
```

**Trust these instructions first. Only search/explore if incomplete or contradicts behavior. Check README.md, CONTRIBUTING.md, docs/ for details.**

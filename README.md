# Avocat-AI Francophone Monorepo

This repository contains the production implementation scaffold for the Avocat-AI Francophone autonomous legal agent. It is organised as a PNPM workspace with API, operational tooling, Supabase integrations, database migrations, and shared packages for schemas and constants.

**Production Status**: Deployed on Cloudflare Pages (App) and Supabase (API/DB).

## Structure

```
apps/
  api/        # Fastify API service hosting the agent orchestrator and REST endpoints
  edge/       # Supabase Edge Functions (Deno) for crawlers, schedulers, and webhooks
  ops/        # Command-line tooling for ingestion, provisioning, and evaluations
  pwa/        # Next.js PWA surface for litigants and reviewers (App Router, Radix UI, three.js)
  web/        # Next.js operator console for admins and HITL reviewers (App Router, shadcn UI, TanStack Query)

db/
  migrations/ # SQL migrations (Supabase/Postgres)
  seed/       # Seed scripts and helper data

packages/
  shared/     # Shared TypeScript utilities (IRAC schema, allowlists, constants)
  supabase/   # Generated types and helpers for Supabase clients
  ui/         # Shared UI component library
```

## Production Architecture & Configuration

This repository is configured for **Cloudflare Pages** deployment.

### 1. Root Configuration (`wrangler.toml`)
Crucially, the `wrangler.toml` file must live at the **root** of the repository (not in `apps/web`) to ensure Cloudflare Pages automatically detects the build settings and applied compatibility flags.

- **Config File**: [`./wrangler.toml`](./wrangler.toml)
- **Compatibility**: `nodejs_compat` (Required for AsyncLocalStorage and other Node.js polyfills on the Edge).
- **Build Output**: `apps/web/.vercel/output/static`

### 2. Environment Variables
For the application to function in production (Cloudflare Pages), the following secrets must be configured in the project dashboard (**Settings > Environment Variables**):

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key (for server-side admin ops) |
| `NEXT_PUBLIC_API_BASE_URL` | URL of your deployed `apps/api` service |
| `NODE_ENV` | Must be set to `production` |

### 3. Build Workflow
The deployment command leverages `@cloudflare/next-on-pages` to build the Next.js application for the Edge.

**Command**:
```bash
pnpm run deploy:cloudflare:web:preview
```
*   This triggers `pnpm --filter @avocat-ai/web run deploy:cloudflare`.
*   It builds all workspace dependencies first (including `@avocat-ai/ui`).
*   It generates the `_worker.js` and static assets in `.vercel/output/static`.

## Workspace Quickstart

> **⚠️ Important:** The monorepo **must** be managed with pnpm.

1.  **Install dependencies**:
    ```bash
    corepack enable
    pnpm install
    ```

2.  **Environment Setup**:
    Copy `.env.example` to `.env.local` in `apps/web` and populate it.

3.  **Run Development**:
    ```bash
    pnpm dev:web
    ```

## Operations & Runbooks

### 1. Foundation & Provisioning
Initialize the environment (migrations, buckets, vector stores):
```bash
pnpm ops:foundation  # Full setup
pnpm seed            # Seed base data
```

### 2. Compliance & Governance
- **Transprency Reports**: `pnpm ops:transparency ...`
- **SLO Snapshots**: `pnpm ops:slo ...`
- **Red Team**: `pnpm ops:red-team ...`

(See `apps/ops/README.md` for the full operational CLI reference).

## Troubleshooting

### "Node.JS Compatibility Error"
**Cause**: The `nodejs_compat` flag is missing from the Cloudflare environment.
**Fix**: Ensure `wrangler.toml` exists in the **ROOT** of the repo. Cloudflare reads it automatically. If missing, move it to root.

### "Module not found: @avocat-ai/ui"
**Cause**: The build script is not building workspace packages before the app.
**Fix**: Ensure `apps/web/package.json` has `pnpm --filter '../../packages/*' run build` (note the relative path `../../`).

### "Server Components render error"
**Cause**: Missing environment variables at runtime.
**Fix**: Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_API_BASE_URL` to Cloudflare Pages settings.

## Badges & Status
The Admin Dashboard (`/admin/overview`) uses a unified health system:
- **Green**: Healthy / Within Thresholds
- **Amber**: Warning / Acceptable
- **Red**: Critical / Action Required

Configure thresholds via `NEXT_PUBLIC_DASHBOARD_RUNS_HIGH`, `NEXT_PUBLIC_TOOL_FAILURE_CRIT`, etc.

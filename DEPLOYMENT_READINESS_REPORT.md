# Deployment Readiness Report

## Summary
- **Primary target:** `apps/web` (Next.js 14) deploying to Vercel using pnpm workspaces and Node 20.
- **Supporting services:** `apps/api` (Fastify) and `apps/ops` (Node workers) with shared Supabase resources.
- **Overall status:** **Amber** – configuration and validation in place, pending real secrets and verification of `vercel build` with production credentials.

## Inventory highlights
- Package manager: pnpm 8.15.4 (`pnpm-lock.yaml` committed) with Node `>=20 <21` (`.nvmrc` 20.11.0).
- Workspaces documented in `audit/inventory.json`.
- New environment matrix published at `audit/env-matrix.csv` covering web, api, ops, and shared scripts.

## Environment readiness
- `.env.example` files added for `apps/web`, `apps/api`, and `apps/ops` with safe defaults and guidance.
- Runtime validators:
  - `apps/web/src/env.server.ts` + `apps/web/src/env.client.ts` enforce Supabase + public threshold configuration.
  - `apps/api/src/env.server.ts` re-exports the existing Zod schema (tightened by exporting the `Env` type).
  - `apps/ops/src/env.server.ts` adds Zod validation for CLI/worker envs; `lib/env.ts` now honours validated values.
- Missing critical secrets (OpenAI, Supabase) will now fail fast during import/build.

## Vercel configuration
- `apps/web/vercel.json` pins install/build commands and adds `/healthz` route for monitoring.
- `apps/web/next.config.js` now sets `output: 'standalone'` and permissive remote image patterns for hosted assets.
- `audit/vercel-plan.md` documents root directories, commands, and notes per app.

## Build & CI automation
- Added `.github/workflows/vercel-preview-build.yml` to run `vercel pull` + `vercel build` on PRs with Node 20.
- Introduced `scripts/vercel-preflight.mjs` to validate Node version, environment variables, dependency install, and preview build locally.

## Risks & follow-ups
- **Secrets provisioning (Amber):** Vercel project must be populated with Supabase and OpenAI credentials before attempting production build.
- **API deployment (Amber):** `apps/api` assumes Serverless deployment but still needs routing integration (rewrites or custom domain) – document once decided.
- **Ops automation (Amber):** Workers require secure storage of management tokens; consider Vercel cron or external scheduler.

## Time to green
- Provide Vercel project credentials + secrets → 0.5 day.
- Run `scripts/vercel-preflight.mjs` with production env + adjust any failing steps → 0.5 day.
- Confirm preview deployment + smoke test admin panel and API routes → 1 day.
- Total estimated: **~2 business days** pending access to secrets.

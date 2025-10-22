# Deployment Readiness Report

## Summary
- **Primary target:** `apps/web` (Next.js 14) deploying via managed serverless hosting using npm workspaces and Node 20.
- **Supporting services:** `apps/api` (Fastify) and `apps/ops` (Node workers) with shared Supabase resources.
- **Overall status:** **Amber** – configuration and validation in place, pending real secrets and verification of production build pipelines with live credentials.

## Inventory highlights
- Package manager: npm 11.4.2 (`package-lock.json` committed) with Node `>=20 <21` (`.nvmrc` 20.11.0).
- Workspaces documented in `audit/inventory.json`.
- New environment matrix published at `audit/env-matrix.csv` covering web, api, ops, and shared scripts.

## Environment readiness
- `.env.example` files added for `apps/web`, `apps/api`, and `apps/ops` with safe defaults and guidance.
- Runtime validators:
  - `apps/web/src/env.server.ts` + `apps/web/src/env.client.ts` enforce Supabase + public threshold configuration.
  - `apps/api/src/env.server.ts` re-exports the existing Zod schema (tightened by exporting the `Env` type).
  - `apps/ops/src/env.server.ts` adds Zod validation for CLI/worker envs; `lib/env.ts` now honours validated values.
- Missing critical secrets (OpenAI, Supabase) will now fail fast during import/build.

## Hosting configuration
- `apps/web/deployment.config.json` pins install/build commands and adds `/healthz` route for monitoring.
- `apps/web/next.config.js` now sets `output: 'standalone'` and permissive remote image patterns for hosted assets.
- `audit/deployment-plan.md` documents root directories, commands, and notes per app.

## Build & CI automation
- Added `.github/workflows/preview-build.yml` to run managed preview builds on PRs with Node 20.
- Introduced `scripts/deployment-preflight.mjs` to validate Node version, environment variables, dependency install, and preview build locally.

## Risks & follow-ups
- **Secrets provisioning (Amber):** Hosting project must be populated with Supabase and OpenAI credentials before attempting production build.
- **API deployment (Amber):** `apps/api` assumes Serverless deployment but still needs routing integration (rewrites or custom domain) – document once decided.
- **Ops automation (Amber):** Workers require secure storage of management tokens; consider hosted cron or external scheduler.

## Time to green
- Provide hosting project credentials + secrets → 0.5 day.
- Run `scripts/deployment-preflight.mjs` with production env + adjust any failing steps → 0.5 day.
- Confirm preview deployment + smoke test admin panel and API routes → 1 day.
- Total estimated: **~2 business days** pending access to secrets.

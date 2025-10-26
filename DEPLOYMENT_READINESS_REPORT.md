# Deployment Readiness Report

## Summary
- **Primary target:** `apps/web` (Next.js 14) deploying to a Node 20 hosting provider via npm workspaces.
- **Supporting services:** `apps/api` (Fastify) and `apps/ops` (Node workers) with shared Supabase resources.
- **Overall status:** **Amber** – configuration and validation in place, pending real secrets and verification of the production Next.js build with environment-specific credentials.

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
- Hosting provider still to be finalised; capture install/build commands and healthcheck routing once selected.
- `apps/web/next.config.js` sets `output: 'standalone'` and permissive remote image patterns for hosted assets.
- Document root directories, commands, and notes per app in the deployment runbook when the hosting target is locked in.

## Build & CI automation
- GitHub Actions `CI` workflow validates lint/tests/build across workspaces.
- Local preflight should include `npm run build --workspace @avocat-ai/web` using production-like environment variables prior to release.

## Risks & follow-ups
- **Secrets provisioning (Amber):** Hosting provider must be populated with Supabase and OpenAI credentials before attempting production build.
- **API deployment (Amber):** `apps/api` assumes Serverless/container deployment but still needs routing integration (rewrites or custom domain) – document once decided.
- **Ops automation (Amber):** Workers require secure storage of management tokens; consider managed cron or external scheduler.

## Time to green
- Provide hosting credentials + secrets → 0.5 day.
- Run a full Next.js production build with production env + adjust any failing steps → 0.5 day.
- Confirm preview deployment + smoke test admin panel and API routes on the chosen platform → 1 day.
- Total estimated: **~2 business days** pending access to secrets.

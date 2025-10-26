# Deployment Readiness Report

## Summary
- **Primary target:** `apps/web` (Next.js 14) serving via the bundled Node server output (`next start`) behind Supabase auth.
- **Supporting services:** `apps/api` (Fastify) and `apps/ops` (Node workers) sharing Supabase databases and storage.
- **Overall status:** **Amber** – configuration and validation in place pending real secrets and production Supabase access.

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

## Node hosting configuration
- `apps/web/next.config.js` continues to emit the standalone Node server for deployment on any Node 20 target.
- Local health-check endpoints are served from `apps/api` (`/api/healthz`) with routing handled by the web app.
- `audit/env-matrix.csv` tracks the variables required to boot the self-hosted stack (web/api/ops/shared scripts).

## Build & CI automation
- CI relies on workspace lint/typecheck/build scripts; local developers should run `pnpm lint`, `pnpm typecheck`, and `pnpm build` before shipping.
- `scripts/check-binaries.mjs` remains the safeguard preventing accidental large/binary assets in pull requests.

## Risks & follow-ups
- **Secrets provisioning (Amber):** Supabase and OpenAI credentials must be populated in `.env` (and secret managers) prior to production rollout.
- **API routing (Amber):** `apps/api` expects to run alongside the web server or behind a reverse proxy; document ingress wiring in the hosting environment.
- **Ops automation (Amber):** Workers require secure storage of management tokens; schedule execution via cron/containers within your infrastructure.

## Time to green
- Populate Supabase + OpenAI secrets in the hosting environment → 0.5 day.
- Provision ingress + TLS for the Node web server and Fastify API → 0.5 day.
- Run local smoke tests (`pnpm build`, `pnpm start`, API health checks) with production-like data → 1 day.
- Total estimated: **~2 business days** pending access to secrets and infrastructure.

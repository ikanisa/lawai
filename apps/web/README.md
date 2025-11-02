# Operator console (`@avocat-ai/web`)

Internal-facing Next.js console for admins and human-in-the-loop reviewers. Integrates Supabase server actions, audit exports, and observability overlays.

## Prerequisites

- Node.js 20.x, pnpm 8.15.4
- Supabase service role + anon keys
- `EDGE_SERVICE_SECRET` for privileged API calls
- Playwright (optional) for end-to-end coverage

## Install

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @avocat-ai/web run icons:generate
```

## Development

```bash
pnpm dev:web                   # http://localhost:3001
```

The dev script runs `next dev` with pre-build steps (`predev`) that generate icon sprites and service workers.

## Quality gates

```bash
pnpm --filter @avocat-ai/web run lint
pnpm --filter @avocat-ai/web run typecheck
pnpm --filter @avocat-ai/web run test
pnpm --filter @avocat-ai/web run test:e2e    # requires Playwright browsers
```

Vitest uses Happy DOM. Playwright tests target preview deployments—set `PLAYWRIGHT_TEST_BASE_URL` to a live environment or use `next start` locally.

## Build & deploy

```bash
pnpm --filter @avocat-ai/web run build
pnpm --filter @avocat-ai/web run start -- --port 3001
```

Production builds ship to Vercel alongside the public PWA. Merge to `main` after all checks pass and request Vercel promotion through the Release runbook (`../../docs/release-runbook.md`).

## Observability

The console publishes admin interactions, audit exports, and Supabase latency metrics to the **Operator Console** dashboard. Dashboard mapping and alert SLIs are catalogued in [`../../docs/observability.md`](../../docs/observability.md) and the environment crosswalk in [`../../docs/env-matrix.md`](../../docs/env-matrix.md).

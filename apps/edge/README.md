# Supabase Edge Functions (`@apps/edge`)

Collection of Deno-based functions deployed to Supabase Edge. Covers ingestion pipelines, learning feedback loops, transparency reports, and watchdog jobs.

## Prerequisites

- Deno 2.x (`brew install deno`)
- pnpm 8.15.4 for shared lint/test runners
- Supabase project with Edge functions enabled
- `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` for deployments

## Install & bootstrap

Edge functions reuse the monorepo dependencies. Install at the repo root:

```bash
pnpm install
```

Then warm the Deno cache for a specific function:

```bash
deno task dev crawl-authorities
```

## Scripts

| Command | Description |
| --- | --- |
| `deno task dev <function>` | Run the function locally with live reload |
| `deno task bundle` | Emit production bundles into `./dist` |
| `pnpm --filter @apps/edge run test` | Execute Vitest against the Deno shims |
| `pnpm --filter @apps/edge run lint` | Check formatting/imports via `deno lint` wrapper |
| `pnpm --filter @apps/edge run typecheck` | Invoke `deno check` with the shared config |

## Deployment

Use the Supabase CLI from the repo root:

```bash
supabase functions deploy crawl-authorities --project-ref $SUPABASE_PROJECT_REF
```

Deployment tokens are managed through the Ops CLI. Review [`../../docs/ops/provenance-alerts.md`](../../docs/ops/provenance-alerts.md) and the operational scenarios in [`../../docs/RUNBOOKS.md`](../../docs/RUNBOOKS.md) before promoting changes.

## Observability

Functions emit JSON logs consumed by the **Edge Workers** dashboard. Metrics flow through the automation channel documented in [`../../docs/observability.md`](../../docs/observability.md). Use the troubleshooting guide (`../../docs/troubleshooting_network.md`) when Deno deployments fail.

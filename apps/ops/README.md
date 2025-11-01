# Ops automation (`@apps/ops`)

TypeScript CLI collection for provisioning Supabase, seeding datasets, running evaluations, and exporting operational reports.

## Prerequisites

- Node.js 20.x and pnpm 8.15.4
- Access to the Supabase project targeted by automation
- Valid OpenAI credentials (unless running in stub mode)
- `supabase` CLI installed locally for migrations (`brew install supabase/tap/supabase`)

## Install

```bash
pnpm install
cp apps/ops/.env.example apps/ops/.env.local
pnpm --filter @apps/ops run foundation   # first-time provisioning
```

## Key scripts

| Script | Description |
| --- | --- |
| `pnpm --filter @apps/ops run dev` | Launches the interactive CLI shell |
| `pnpm --filter @apps/ops run migrate` | Applies SQL migrations via Supabase API |
| `pnpm --filter @apps/ops run bootstrap` | Creates buckets, allowlists, and syncs ingestion fixtures |
| `pnpm --filter @apps/ops run evaluate` | Executes evaluation suites against the latest prompts |
| `pnpm --filter @apps/ops run phase` | Reports implementation progress against the rollout plan |

See [`../../Makefile`](../../Makefile) for convenience wrappers used in CI.

## Quality gates

```bash
pnpm --filter @apps/ops run lint
pnpm --filter @apps/ops run typecheck
pnpm --filter @apps/ops run test
```

Vitest suites stub network calls by default. Set `USE_SUPABASE_STUB=false` to exercise live infrastructure.

## Runbooks & observability

Operational scenarios for this CLI are catalogued in [`../../docs/RUNBOOKS.md`](../../docs/RUNBOOKS.md). Each command emits structured JSON logs consumed by the **Automation** dashboard in Grafana (see [`../../docs/observability.md`](../../docs/observability.md)).

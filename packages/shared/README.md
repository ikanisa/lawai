# Shared utilities (`@avocat-ai/shared`)

Cross-cutting TypeScript helpers: configuration loaders, IRAC schemas, scheduling logic, transparency helpers, and constants shared across the monorepo.

## Install

```bash
pnpm install
```

## Scripts

```bash
pnpm --filter @avocat-ai/shared run lint
pnpm --filter @avocat-ai/shared run typecheck
pnpm --filter @avocat-ai/shared run test
pnpm --filter @avocat-ai/shared run build
```

## Highlights

- `config/env.ts` – Zod schema for validating shared secrets and runtime toggles
- `transparency.ts` – Utilities for SLO and transparency reporting consumed by Ops
- `scheduling.ts` – Helpers for cron-style calculations used by Edge and Ops workers

Refer to [`../../docs/env-matrix.md`](../../docs/env-matrix.md) when adding new configuration keys so the environment matrix stays current.

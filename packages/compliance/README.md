# Compliance helpers (`@avocat-ai/compliance`)

Shared utilities for redacting sensitive data, enforcing residency policies, and generating regulator-facing digests.

## Install

```bash
pnpm install
```

## Scripts

```bash
pnpm --filter @avocat-ai/compliance run lint
pnpm --filter @avocat-ai/compliance run typecheck
pnpm --filter @avocat-ai/compliance run test
pnpm --filter @avocat-ai/compliance run build
```

Vitest targets pure functions—no external services required.

## Integration tips

- Use the Zod schemas exported from `@avocat-ai/compliance/residency` before persisting Supabase records.
- Pass the redaction helpers to `pino` serializers in the API to prevent secrets leaking into logs.
- Automation commands (`apps/ops`) load this package to assemble regulator digests referenced in [`../../docs/runbooks/ops-scheduler-evaluation.md`](../../docs/runbooks/ops-scheduler-evaluation.md).

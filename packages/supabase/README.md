# Supabase bindings (`@avocat-ai/supabase`)

Typed clients and helpers generated from Supabase schemas. Used by API, Web server actions, and Ops automation.

## Install

```bash
pnpm install
```

## Scripts

```bash
pnpm --filter @avocat-ai/supabase run lint
pnpm --filter @avocat-ai/supabase run typecheck
pnpm --filter @avocat-ai/supabase run test
pnpm --filter @avocat-ai/supabase run build
```

## Schema sync

Run after migrations to refresh generated types:

```bash
pnpm --filter @apps/ops run vectorstore
pnpm exec supabase gen types typescript --linked > packages/supabase/src/generated.ts
```

Commit the regenerated file and update [`../../docs/env-matrix.md`](../../docs/env-matrix.md) if new configuration is introduced.

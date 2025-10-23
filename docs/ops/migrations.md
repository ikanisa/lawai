# Database Migrations – Canonical Path

Canonical location: `db/migrations`

- All new SQL migrations must live under `db/migrations`.
- The CI job `check:migrations` enforces that `supabase/migrations` is empty and validates basic ordering.
- Archive or historical files may remain in `supabase/migrations_archive/`, but they are not applied.

## Conventions

- File naming: strictly `YYYYMMDDHHMMSS_slug.sql`. CI generates [`db/migrations/manifest.json`](../../db/migrations/manifest.json) which captures ordering, checksums, and rollback strategy hints.
- Dependency graph: the manifest stores canonical dependency arrays. Sequential migrations inherit a dependency on the previous ID automatically; add overrides in [`db/migrations/dependency-overrides.json`](../../db/migrations/dependency-overrides.json) when a migration depends on multiple predecessors. CI enforces that overrides point to existing, earlier migrations.
- Use `pnpm lint:sql` (or `npm run lint:sql`) to enforce formatting across `db/` and `supabase/` SQL files. The command runs in CI and via `.lefthook.yml`.
- Regenerate the manifest after editing SQL with `node scripts/generate-migration-manifest.mjs` and commit the result.
- Migrations should be idempotent and safe to run on empty databases.
- RLS policies must be present for multi‑tenant tables; add an RLS smoke entry to the ops scripts when changing table access.

## Applying Migrations

- Local: use your preferred psql process or Supabase CLI.
- CI: A full DB apply is not performed by default. Use the `rls-smoke` job with environment secrets to validate a target instance.

## RLS Smoke

- A dedicated CI job (`rls-smoke`) is provided and runs when repository `RUN_RLS_SMOKE` variable is set to `true` and Supabase secrets are available.
- Integrate `apps/ops` scripts to perform end‑to‑end RLS assertions in your target environment.


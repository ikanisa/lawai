# Database Migrations – Canonical Path

Canonical location: `db/migrations`

- All new SQL migrations must live under `db/migrations`.
- The CI job `check:migrations` enforces that `supabase/migrations` is empty and validates basic ordering.
- Archive or historical files may remain in `supabase/migrations_archive/`, but they are not applied.

## Conventions

- File naming: `NNNN_description.sql` or timestamp prefixes. CI checks for duplicates and ordering.
- Migrations should be idempotent and safe to run on empty databases.
- RLS policies must be present for multi‑tenant tables; add an RLS smoke entry to the ops scripts when changing table access.

## Applying Migrations

- Local: use your preferred psql process or Supabase CLI.
- CI: A full DB apply is not performed by default. Use the `rls-smoke` job with environment secrets to validate a target instance.

## RLS Smoke

- A dedicated CI job (`rls-smoke`) is provided and runs when repository `RUN_RLS_SMOKE` variable is set to `true` and Supabase secrets are available.
- Integrate `apps/ops` scripts to perform end‑to‑end RLS assertions in your target environment.


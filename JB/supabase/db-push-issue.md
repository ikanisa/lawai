# Supabase `db push` Status

- Project ref: `ttbjgzzabnecihoeqrtj`
- CLI: `supabase $(supabase --version)`
- Current result: ✅ `supabase db push` completes with "Remote database is up to date."

## What Changed

- Archived the legacy migration history so the CLI examines a single baseline migration stored in `supabase/migrations/20251003171500.sql`.
- Reset `supabase_migrations.schema_migrations` to contain only the numeric version `20251003171500`, matching the new baseline file.
- Added `supabase/migrations/20251003173000_create_drafts.sql` to provision the new `public.drafts` table (run `supabase db push --include-all` to apply it remotely).
- Relocated the former SQL scripts to `supabase/migrations_archive/` for reference.

## Artifacts

- `supabase/db-push-debug.log` — previous failing runs (kept for posterity).
- `supabase/db-push-parity.json` — confirms local vs remote alignment for the new baseline setup.

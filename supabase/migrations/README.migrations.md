# Supabase CLI Migration Cache

The authoritative migration history for Lawai lives in `db/migrations/`.  
However, the Supabase CLI only looks inside `supabase/migrations/` when you run
`supabase db push` or `supabase migration ...`. To keep both workflows happy:

1. Add or edit migrations under `db/migrations/` only.
2. Mirror any files that the remote environment needs into this folder (for
   example via `cp db/migrations/<file>.sql supabase/migrations/`).
3. Keep the two directories in sync within the same commit.

This folder exists solely as a cache for the CLI; do not create migrations here
directly. Historical migrations that pre-date `db/migrations/` are stored under
`supabase/migrations_archive/` for reference.

RLS Smoke in CI
----------------

Goal: run a lightweight RLS (Row Level Security) smoke test against a target Supabase project on each PR/merge.

Prerequisites
- Supabase project with required extensions enabled: `pg_cron`, `pg_net`.
- Service Role key scoped to the project with least privilege.

CI configuration
1) Repository variable
   - Add a repository variable `RUN_RLS_SMOKE` with value `true`.

2) Repository secrets
   - Add `SUPABASE_URL` (e.g., `https://<project-ref>.supabase.co`).
   - Add `SUPABASE_SERVICE_ROLE_KEY` (Service Role key for the project).

3) CI job
   - The workflow `.github/workflows/ci.yml` contains an optional job `rls-smoke`:

     - It runs when `RUN_RLS_SMOKE` is `true` and both secrets are present.
     - It uses the `apps/ops` script to perform basic assertions.

   - Local run equivalent:
     ```bash
     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm --filter @apps/ops rls-smoke
     ```

What it checks
- Confirms critical tables have RLS enabled.
- Verifies common roles cannot read other tenants’ rows.
- Ensures basic policy coverage for ingestion/quarantine/drive manifests and org-scoped metrics.

Notes
- Keep secrets in your secret manager; do not put real keys in `.env.example`.
- This smoke is non-destructive and reads metadata + limited sample rows.


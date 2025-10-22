# Vercel Deployment Guide

This guide captures the minimum configuration required to ship the Francophone Avocat-AI stack to Vercel. It assumes that you are deploying the Next.js front-end (`@avocat-ai/web`) and the Fastify API (`@apps/api`) via Vercel Serverless Functions while relying on Supabase for persistence.

---

## 1. Required environment variables

Set the following variables in **Vercel → Project Settings → Environment Variables**. Unless noted otherwise, define them for the `Preview` and `Production` environments.

| Variable | Scope | Purpose / notes |
| --- | --- | --- |
| `OPENAI_API_KEY` | Server | Required for all LLM calls. Rotate immediately if exposed.
| `AGENT_MODEL` | Server | Overrides the default model (defaults to `gpt-5-pro`).
| `EMBEDDING_MODEL` | Server | Embedding model used during ingestion (`text-embedding-3-large`).
| `SUMMARISER_MODEL` | Server | Model used to create document summaries.
| `OPENAI_VECTOR_STORE_AUTHORITIES_ID` | Server | Optional. Pre-provision a vector store and place its ID here to avoid re-creation.
| `NEXT_PUBLIC_API_BASE_URL` | Client | URL of the deployed API (e.g. `https://<project>-api.vercel.app`).
| `FEAT_ADMIN_PANEL` | Client | Set to `1` when the administration panel must be exposed in production.
| `SUPABASE_URL` | Client | URL of your Supabase project (`https://<ref>.supabase.co`).
| `SUPABASE_ANON_KEY` | Client | Public anon key (safe to expose to the browser).
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Service role key used by the API for privileged operations. **Never expose in client scope.**
| `SUPABASE_DB_URL` | Server | `postgresql://` connection string used for migrations and scripts. Store it as a server secret only.
| `SUPABASE_PROJECT_REF` | Server | Optional helper for automation (e.g. ops scripts and metrics collectors).
| `SUPABASE_ACCESS_TOKEN` | Server | Required when automating Supabase management API calls (bucket provisioning, quotas, etc.).
| `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_TEMPLATE_OTP_NAME`, `WA_TEMPLATE_LOCALE` | Server | Required if WhatsApp OTP delivery is enabled.
| `ALERTS_SLACK_WEBHOOK_URL` | Server | Optional Slack webhook for incident notifications.
| `ADMIN_PANEL_ACTOR`, `ADMIN_PANEL_ORG` | Server | Optional overrides for the admin panel’s default actor identifiers.

> ℹ️ **Tip:** keep the Server-scoped variables in Vercel’s “Environment Variables → Encrypted” section and copy only the client-safe values to `NEXT_PUBLIC_*` keys.

---

## 2. Supabase provisioning checklist

1. **Create the project**
   - Region: choose the closest low-latency region to your operator console users.
   - Database password: store the generated password, it forms the basis of `SUPABASE_DB_URL`.

2. **Apply migrations and bootstrap data**
   - Install the Supabase CLI and authenticate (`supabase login`).
   - Set `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ACCESS_TOKEN` locally.
   - Run the repository automation from the project root:
     ```bash
     pnpm ops:foundation
     ```
     The script applies SQL migrations (`supabase/migrations`), provisions the required storage buckets (`authorities`, `uploads`, `snapshots`), checks Postgres extensions (`pgvector`, `pg_trgm`), syncs allowlisted domains, and validates mandatory secrets.

3. **Seed required reference data**
   - Execute once after provisioning:
     ```bash
     pnpm seed
     ```
     This loads the default jurisdictions, residency allowlist, and evaluation fixtures referenced by the operator tooling.

4. **Configure RLS policies (if not already present)**
   - Ensure the tables created by the migrations keep their Row Level Security policies enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - Confirm that the generated policies in `supabase/migrations/*_rls.sql` exist in your project (they are essential for jurisdiction and residency enforcement).

5. **Optional automation tokens**
   - If the operations team intends to run nightly evaluations or transparency reports from CI, create a Supabase service role token dedicated to CI and assign it to the `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_ACCESS_TOKEN` pair used in GitHub Actions.

---

## 3. Build and verification commands

Before triggering a Vercel deployment, reproduce the CI steps locally to guarantee deterministic builds:

```bash
# Install workspace dependencies
pnpm install

# Verify code quality
pnpm -r lint
pnpm -r test
pnpm --filter @apps/api typecheck
pnpm --filter @avocat-ai/web typecheck

# Generate the production bundles
pnpm --filter @apps/api build
pnpm --filter @avocat-ai/web build
pnpm --filter @apps/pwa build

# Enforce bundle budgets for the PWA shell
pnpm --filter @apps/pwa bundle:check
```

> ✅ If every command above succeeds, the repository state matches what the `CI` workflow runs on pull requests. Merge only after the workflow reports success to guarantee deployable artifacts on Vercel.

---

## 4. Linking GitHub and Vercel

1. Import the repository into Vercel and select the **pnpm** framework preset.
2. In the “Build & Development Settings” section, set the **Install Command** to `pnpm install` and the **Build Command** to `pnpm --filter @avocat-ai/web build` (Vercel will automatically execute API builds for Serverless functions).
3. Add the environment variables listed above before triggering the first deployment.
4. Enable the “Automatically expose System Environment Variables” toggle to inherit `VERCEL_URL` for dynamic API base URL calculation when needed.
5. (Optional) Configure a production branch alias (e.g. `main`) so only reviewed pull requests can promote to production once CI succeeds.

For deeper operational procedures—red teaming, transparency reporting, or Supabase maintenance—refer to the runbooks in `docs/operations/` and `docs/runbooks/`.

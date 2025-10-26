# Deploying the Avocat-AI PWA to Vercel

This guide walks through the settings required to produce production-ready builds of the **public PWA** that lives in [`apps/pwa`](../../apps/pwa). It covers the secrets that must be configured, the Supabase preparation needed before the first deployment, and the commands that reproduce the build pipeline locally.

> ℹ️ The internal **operator console** (`apps/web`) ships through separate pipelines (self-hosted or container-based). Follow the [local hosting runbook](../local-hosting.md) or your platform-specific deployment guide when promoting the console so that it does not mix with the PWA artefacts described here.

## Prerequisites

- **Vercel account** with access to the GitHub repository (or a linked fork).
- **Node.js 20.x** locally (matches the runtime declared in the repository).
- **Supabase project** created in the desired region.
- **OpenAI organisation credentials** that the API service uses to call the legal research models.

> 💡 Use the automation scripts in this repository whenever possible (`npm run ops:foundation`, `npm run ops:check`, etc.) to keep Supabase in sync with the schema expected by the web and API services.

## Required environment variables

Add the following variables in Vercel (`Settings → Environment Variables`). Use the **Production** scope for values that power your main deployment and **Preview** for staging branches. Avoid exposing secrets in Preview if you do not control the branch author.

### Server-only secrets

| Variable | Required? | Description |
| --- | --- | --- |
| `SUPABASE_URL` | ✅ | Base URL of your Supabase project. Used by the Next.js server to perform privileged operations. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key scoped to the Supabase project. Required for server components to execute administrative flows. |
| `OPENAI_API_KEY` | ✅ | API key used by server routes that proxy agent requests. Rotate if exposed. |
| `APP_ENV` | ✅ | Use `production` for the live site. Enables production-only toggles inside the app. |
| `ADMIN_PANEL_ACTOR` | Optional | Default operator email injected into admin routes when headers are absent (useful for cron jobs). |
| `ADMIN_PANEL_ORG` | Optional | Default organisation UUID mapped to admin actions. |
| `FEAT_ADMIN_PANEL` | Optional | Set to `enabled` to expose the admin panel in production. |

### Public runtime settings

These values are safe to expose in the browser. Prefix them with `NEXT_PUBLIC_` exactly as shown so that the client bundle can consume them.

| Variable | Required? | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | HTTPS URL of the deployed API (for example, `https://api.avocat-ai.example`). |
| `NEXT_PUBLIC_DASHBOARD_RUNS_HIGH` | ✅ | Threshold that triggers red metrics on the dashboard (keep defaults unless product asks otherwise). |
| `NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM` | ✅ | Medium alert threshold on dashboard widgets. |
| `NEXT_PUBLIC_EVAL_PASS_GOOD` | ✅ | Passing ratio for evaluation suites. |
| `NEXT_PUBLIC_EVAL_PASS_OK` | ✅ | Warning ratio for evaluation suites. |
| `NEXT_PUBLIC_EVAL_COVERAGE_GOOD` | ✅ | Retrieval coverage target. |
| `NEXT_PUBLIC_EVAL_COVERAGE_OK` | ✅ | Retrieval coverage warning. |
| `NEXT_PUBLIC_EVAL_MAGHREB_GOOD` | ✅ | Minimum acceptable Maghreb compliance ratio. |
| `NEXT_PUBLIC_EVAL_MAGHREB_OK` | ✅ | Warning threshold for Maghreb compliance. |
| `NEXT_PUBLIC_TOOL_FAILURE_WARN` | ✅ | Warning ratio for tool invocation failures. |
| `NEXT_PUBLIC_TOOL_FAILURE_CRIT` | ✅ | Critical ratio for tool invocation failures. |

### Optional integrations

| Variable | Description |
| --- | --- |
| `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_TEMPLATE_OTP_NAME`, `WA_TEMPLATE_LOCALE` | Configure if WhatsApp OTP delivery is required. |
| `C2PA_SIGNING_PRIVATE_KEY`, `C2PA_SIGNING_KEY_ID` | Set when enabling content provenance signatures. |

## Supabase configuration checklist

1. **Create the project** and note the `Project ref`, anon key, service role key, and database URL.
2. **Run the canonical migrations** against the project:
   ```bash
   npm install
   npm run db:migrate
   ```
3. **Provision operational prerequisites** (buckets, allowlists, vector stores, feature flags):
   ```bash
   npm run ops:foundation
   ```
4. **Verify residency, buckets, and vector store connectivity** before the first deploy:
   ```bash
   npm run ops:check
   ```
5. **Optional:** Deploy Supabase Edge Functions using the `Deploy` GitHub workflow or the Supabase CLI once the secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`) are configured.

Refer to `docs/SUPABASE_AND_AGENT_MANIFEST.yaml` if you need a complete inventory of tables, policies, and storage assets that must exist in Supabase.

## Build and deploy steps

Reproduce the build locally before pushing to Vercel:

```bash
pnpm install --recursive
pnpm --filter @apps/pwa lint
pnpm --filter @apps/pwa test
pnpm --filter @apps/pwa build
npx vercel pull --yes --environment=production
npx vercel build
npx vercel deploy --prebuilt --prod
```

> Prefer `npm`? Replace the first four commands with `npm ci` followed by `npm run lint/test/build --workspace @apps/pwa`.

When validating operator console changes locally, continue to use `pnpm dev:web`, `pnpm --filter @avocat-ai/web build`, and `pnpm --filter @avocat-ai/web test`. Keeping the command sets separated avoids deploying console artefacts to the PWA hosting project.

- Use `--environment=preview` for staging builds.
- The `vercel build` output is what Vercel serves in both preview and production environments.

## Continuous integration guardrails

The `Vercel Preview Build` workflow (`.github/workflows/vercel-preview-build.yml`) now runs linting, tests, and a workspace build before invoking `vercel build`. Keep the workflow green to guarantee that every merge request produces an artifact that Vercel can deploy without manual intervention.

## Post-deployment validation

1. Visit your deployed health check endpoint to confirm that server routes respond (for the operator console, see the `/healthz` mapping in `apps/web/vercel.json`).
2. Launch the admin panel (if enabled) and confirm Supabase calls succeed.
3. Review the GitHub deployment summary to ensure Supabase migrations and optional RLS smoke tests passed.
4. Monitor Supabase logs for new errors immediately after the rollout.

Once these checks pass, promote the deployment in Vercel.

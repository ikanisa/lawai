# Operational runbooks

This index curates the scenarios every on-call engineer should know. Each entry links to a detailed playbook in `docs/runbooks/` or `docs/ops/` and cross-references the observability dashboards that validate success.

## 1. Ingestion recovery

- **Trigger:** Edge crawl fails, `crawl-authorities` alerts fire, or Grafana **Edge Workers › Error rate** panel breaches thresholds.
- **Steps:**
  1. Review latest logs in the Edge Workers dashboard (filters on `function=crawl-authorities`).
  2. Follow [`runbooks/wa_key_rotation.md`](runbooks/wa_key_rotation.md) if auth tokens expired.
  3. Redeploy the function (`supabase functions deploy crawl-authorities`).
  4. Validate via Ops CLI: `pnpm --filter @apps/ops run check`.
- **Escalation:** Notify data ingestion owner on-call if failures persist after redeploy.

## 2. Evaluation pipeline regression

- **Trigger:** Scheduled `ops-scheduler-evaluation` job fails or Grafana **Automation › Evaluation latency** exceeds SLO.
- **Steps:**
  1. Consult [`runbooks/ops-scheduler-evaluation.md`](runbooks/ops-scheduler-evaluation.md) for error triage.
  2. Run `pnpm --filter @apps/ops run evaluate -- --suite smoke` locally with stubbed credentials to reproduce.
  3. If OpenAI throttling is suspected, check the **OpenAI Request Health** dashboard (see [`observability.md`](observability.md#dashboards)).
  4. Re-run the job via `pnpm --filter @apps/ops run reports-cron` once mitigated.
- **Escalation:** Engage the ML / evaluation team if baseline scores regress >5%.

## 3. Web or PWA outage

- **Trigger:** Vercel health checks failing, 5xx spikes on **User Experience › Error rate** dashboard, or smoke tests red in Release pipeline.
- **Steps:**
  1. Follow [`ops/rls-smoke.md`](ops/rls-smoke.md) to validate Supabase Row Level Security.
  2. Run `pnpm --filter @apps/pwa run lint && pnpm --filter @apps/pwa run build` to confirm builds still succeed locally.
  3. Inspect Vercel deployment logs and correlate with Grafana front-end panels.
  4. If Supabase connectivity is broken, consult [`troubleshooting_network.md`](troubleshooting_network.md).
- **Escalation:** Page the web platform lead for incidents lasting >15 minutes.

## 4. Transparency digest failure

- **Trigger:** `transparency-digest` Edge function alert, Ops CLI `pnpm ops:transparency` failure, or dashboard gap in **Transparency › Publishing cadence**.
- **Steps:**
  1. Run `pnpm --filter @apps/ops run transparency -- --dry-run` to inspect latest dataset.
  2. Verify Supabase storage buckets via `pnpm --filter @apps/ops run check`.
  3. If data gaps persist, execute `deno task dev transparency-digest` locally using recorded inputs.
  4. Publish manual digest via Ops CLI once validated.
- **Escalation:** Notify compliance lead if digest remains blocked >24 hours.

## 5. Secrets rotation & drift

- **Trigger:** Alerts from **Automation › Secrets freshness** or governance audit tasks.
- **Steps:**
  1. Execute `pnpm --filter @apps/ops run rotate-secrets`.
  2. Update Vercel + Supabase project secrets as prompted.
  3. Cross-check `docs/env-matrix.md` to ensure new keys are documented.
  4. Re-run `pnpm ops:check` to confirm parity.
- **Escalation:** Escalate to security team if any production secret remains stale after 48 hours.

For additional edge-case playbooks (OTP abuse, GDPR removals, WhatsApp rotations) see the dedicated files under [`docs/runbooks/`](runbooks).

# Outstanding Items

## BLOCKER
- **Rotate previously leaked OpenAI/Supabase credentials** (operational follow-up)
  - *Repro*: Keys were committed historically; although `.env.example` now uses placeholders, provider rotation cannot be validated in-repo.
  - *Impact*: Without rotation, compromised credentials remain valid.
  - *Fix sketch*: Rotate OpenAI project key + Supabase service role/anon keys and update secret manager entries; confirm via audit logs.

## HIGH
- **Vector store sync never waits for READY** (`apps/ops/src/vector-store.ts:82-109`)
  - *Repro*: Upload large PDF; script marks `vector_store_status='uploaded'` instantly.
  - *Fix sketch*: Poll file status with timeout/backoff before updating Supabase; add failure alerting.
- **Evaluation harness does not gate on plan thresholds** (`apps/ops/src/evaluate.ts:400-520`, `.github/workflows/ci.yml:53-105`)
  - *Repro*: Run `pnpm ops:evaluate` with failing metrics—process exits 0.
  - *Fix sketch*: Calculate p95 metrics and `process.exit(1)` when below thresholds; surface in CI summary.
- **Disaster recovery playbook missing** (no files under `ops/`)
  - *Repro*: Search repo—no restore automation or documented drill.
  - *Fix sketch*: Author DR runbook covering Supabase backup restore, vector store rebuild, incident comms; schedule test.

## MEDIUM
- **Route-level Core Web Vitals not segmented** (`apps/api/src/server.ts:539-724`)
  - *Repro*: Operations overview shows org-wide vitals only; no distinction between Research/Admin/Trust routes.
  - *Fix sketch*: Capture route/action in telemetry payload and extend aggregation to report per-route budgets.
- **Compliance alerts not yet pushing to Slack/PagerDuty** (`apps/web/src/components/governance/operations-overview-card.tsx`)
  - *Repro*: Alerts render in dashboard but no outbound notification when CEPEJ/Maghreb/Rwanda breaches occur.
  - *Fix sketch*: Add worker/cron to poll compliance alerts and dispatch to Ops/Compliance channels.

## LOW
- **Performance snapshot metadata conflates allowlist ratio & citation precision** (`apps/ops/src/performance-snapshot.ts:76-117`)
  - *Fix sketch*: Store separate fields for citation precision, temporal validity, and allowlist ratio in metadata payload.

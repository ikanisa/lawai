# Disaster Recovery & Rollback Runbook

_Last reviewed: 2024-09-21_

This runbook captures the playbook for restoring the Avocat-AI platform after a
major incident (data corruption, regional outage, deployment regression) and
documents the rollback drills that must be executed quarterly.

## 1. Objectives & Recovery Targets

- **RPO (Recovery Point Objective):** 15 minutes – production Postgres point-in-
  time recovery with WAL archiving to Cloud Storage.
- **RTO (Recovery Time Objective):** 60 minutes – full stack restored in the same
  region or failover region (Paris ↔ Montréal).
- **Critical datasets:** `supabase` Postgres, vector store snapshots, evidence
  artifacts, governance publications.

## 2. Incident Classification

| Severity | Trigger | Required actions |
| --- | --- | --- |
| **S0** | Data loss or corruption detected; primary region unavailable. | Activate full DR restore + cross-region failover. |
| **S1** | Rolling deployment introduces blocking regression. | Execute application rollback and restore warm backups of vector store. |
| **S2** | Partial outage (single worker/queue stalled). | Restart component, verify health checks, no data restore needed. |

## 3. Runbook Steps

### 3.1 Declare incident & freeze changes

1. Incident commander (platform on-call) creates incident in Ops channel and
   pages secondary engineer.
2. Halt all deploy pipelines (`ops:deploy --freeze`) and notify stakeholders
   (Ops, Compliance, Pilot leads).

### 3.2 Snapshot current state

- Export application logs, Supabase metrics, and UI telemetry events covering
  the last 24 hours (used for post-mortem and rollback validation).
- For rollback-only scenarios, capture current production build hash in
  `ops/reports/ROLLBACK_LOG.md`.

### 3.3 Database recovery

1. Determine recovery point from monitoring (latest successful WAL archive).
2. In Supabase dashboard or CLI:
   ```bash
   supabase db restore --project-ref $SUPABASE_PROJECT_REF \
     --backup-id $BACKUP_ID --region $FAILOVER_REGION
   ```
3. After restore completes, apply pending migrations:
   ```bash
   pnpm db:migrate -- --project $SUPABASE_PROJECT_REF
   ```
4. Run smoke tests: `pnpm ops:rls-smoke` and `pnpm ops:check -- --ci` against the
   restored endpoint.

### 3.4 Vector store & evidence artifacts

1. Promote most recent vector store snapshot stored in `s3://avocat/vector-store`
   via `apps/ops/src/vector-store.ts --restore` (dry-run first).
2. Trigger re-embedding job for high-risk authorities:
   ```bash
   pnpm --filter @apps/ops vectorstore -- --org $ORG_ID --replay-since 24h
   ```
3. Validate HNSW rebuild by running `pnpm --filter @apps/api test --runInBand
   test/case-quality.test.ts`.

### 3.5 Application rollback (if required)

1. Identify last green deployment (`ops/reports/DEPLOY_LOG.md`).
2. Roll back API/Web artefacts via CI workflow dispatch or:
   ```bash
   pnpm --filter @apps/api deploy -- --ref $LAST_GOOD_COMMIT
   pnpm --filter @avocat-ai/web deploy -- --ref $LAST_GOOD_COMMIT
   ```
3. Restart background workers (learning, vector store sync) with `pnpm
   --filter @apps/ops restart`.

### 3.6 Verification checklist

- ✅ `/healthz` endpoint returns 200 in both regions.
- ✅ Jurisdiction banners (Maghreb/Rwanda) render on sample questions.
- ✅ Evaluations pass acceptance thresholds (`pnpm --filter @apps/ops evaluate
  -- --ci`).
- ✅ Governance dashboard shows CEPEJ pass rate and compliance alerts cleared.

### 3.7 Post-incident actions

- Record timeline, root cause, and remediations in
  `ops/reports/INCIDENT_POSTMORTEMS.md` within 48 hours.
- Raise follow-up tickets for missing automation or guardrails.
- Schedule retro + DR drill review with Compliance & Platform teams.

## 4. Quarterly Restore Drill

1. **Schedule:** First week of each quarter; alternate failover region.
2. **Scope:**
   - Restore latest WAL backup into staging project.
   - Rehydrate vector store snapshot and run red-team queries.
   - Execute `pnpm ops:performance-snapshot --dry-run` to confirm telemetry.
3. **Success criteria:** Drill completed within 60 minutes, validation checklist
   signed off, post-drill report published in Trust Center.

## 5. Contact Matrix

| Role | Primary | Secondary |
| --- | --- | --- |
| Incident Commander | @amadou | @camille |
| Database | @sofia | @léa |
| Vector Store | @mathieu | @camille |
| Communications | @claire | @inès |

## 6. References

- Supabase PITR docs
- OpenAI vector store snapshot procedure
- Incident response plan (`incident_response_plan.md`)
- Change management playbook (`change_management_playbook.md`)


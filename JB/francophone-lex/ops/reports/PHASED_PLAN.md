# Phased Implementation Plan

## P0 (Blockers, 48–72h)
- **Scrub `.env.example` and rotate exposed credentials** *(repo sanitised; rotation pending)*
  - Owner: Security (Amadou)
  - Acceptance: `.env.example` now uses placeholders and secret scanning runs in CI; provider key rotation to be confirmed via audit logs.
- **Restore `computeCaseScore` & `buildTreatmentGraph` tool chain — ✅ Completed**
  - Owner: Agents (Léa)
  - Acceptance: `/case-scores` and `/case-treatments` reflect new runs; unit test invoking tools passes; regression covers Supabase inserts.
- **Wire mandated guardrails (binding language, structured IRAC, sensitive-topic HITL) — ✅ Completed**
  - Owner: Agents (Romain)
  - Acceptance: Synthetic run missing IRAC triggers retry then HITL; Maghreb binding violation blocked; unit tests for each guardrail added.
- **Re-embed corpus at 3072 dims and rebuild HNSW — ✅ Completed**
  - Owner: Data (Sofia)
  - Acceptance: `document_chunks.embedding` altered to vector(3072); reindex script logs success; retrieval smoke test meets baseline NDCG.
- **Harden confidential mode storage & UI — ✅ Completed**
  - Owner: Frontend (Inès)
  - Acceptance: Confidential run leaves no entries in `localStorage`; previews blurred; telemetry/timers disabled; automated privacy test passes.

## P1 (7–10 days)
- **Extend allowlist + UI banners for Rwanda — ✅ Completed**
  - Owner: Data/Frontend (Sofia & Inès)
  - Acceptance: Rwanda hosts seeded; Research view shows triage banner; compliance metrics reflect RW ingestion.
- **Add vector store READY polling & alerting — ✅ Completed**
  - Owner: Ops (Mathieu)
  - Acceptance: CLI polls until READY/FAILED; failures mark documents in Supabase and log error.
- **Enforce evaluation thresholds in CI — ✅ Completed**
  - Owner: Ops (Camille)
  - Acceptance: `pnpm ops:evaluate -- --ci` exits non-zero when thresholds fall below targets; CI surface failures.
- **Ship PWA shortcuts & install prompt UX — ✅ Completed**
  - Owner: Frontend (Inès)
  - Acceptance: Manifest exposes required shortcuts; install prompt appears after a successful run; banner dismissible.

## P2 (≤30 days)
- **Author and rehearse DR/rollback playbook — ✅ Completed**
  - Owner: Platform (Amadou)
  - Acceptance: Disaster recovery runbook published (`docs/governance/disaster_recovery_runbook.md`); Trust Center hosts the public copy; quarterly drill scheduled with rollback checklist.
- **Publish compliance dashboards (Maghreb/Rwanda, CEPEJ) — ✅ Completed**
  - Owner: Compliance (Claire)
  - Acceptance: Admin operations overview now surfaces CEPEJ results, Maghreb/Rwanda coverage, and alerts; Trust Center publications updated with latest collateral.
- **Instrument core web vitals + performance snapshots — ✅ Completed**
  - Owner: Frontend/Ops (Inès & Camille)
  - Acceptance: `reportWebVitals` posts LCP/INP/CLS to telemetry; operations overview highlights breaches; performance snapshot CLI stores vitals metadata.

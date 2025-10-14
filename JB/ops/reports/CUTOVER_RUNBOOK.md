# Cutover Runbook – Avocat-AI Francophone

## 1. Pre-flight Checklist
- ✅ Rotate OpenAI & Supabase credentials and update secret manager references.
- ✅ Confirm `document_chunks` migrated to vector(3072) and re-embedded.
- ✅ Guardrail suite deployed (binding language, structured IRAC, sensitive-topic HITL).
- ✅ Ops CLI `pnpm ops:vector-store --dry-run` succeeds against staging.
- ✅ CI green with evaluation thresholds enforced.
- ✅ Incident bridge + on-call roster published.

## 2. Feature Flags / Config Toggles
- `AGENT_STUB_MODE=never` once guardrails validated.
- `CONFIDENTIAL_MODE_ENFORCED=true` after UI changes land.
- `ENABLE_RW_JURISDICTION=1` post allowlist patch.
- `OPS_ALERT_WEBHOOK` set to production channel before ingestion resume.

## 3. Migration Order
1. Apply SQL migrations via `pnpm db:migrate` (includes vector dimension change).
2. Run `pnpm ops:bootstrap` to sync storage buckets/domains.
3. Execute backfill: `pnpm ops:vector-store --reembed` to recompute embeddings.
4. Seed compliance metrics: `pnpm ops:phase-progress --json` verify coverage.

## 4. Seeds / Background Jobs
- Kick off ingestion catch-up: `supabase functions invoke crawl-authorities --payload '{"orgId":"..."}'` per jurisdiction.
- Schedule learning worker: `supabase functions deploy process-learning && supabase functions invoke process-learning`.
- Trigger evaluation smoke set: `pnpm ops:evaluate --limit 10 --org <org> --user <user>`.

## 5. Canary Plan
- Route first 5 pilot users via feature flag (`org_policies.pilot_release=true`).
- Monitor canary dashboard (retrieval latency, allowlist ratio, HITL escalations) for 2h window.
- If metrics within ±10% baseline, expand to full tenant cohort.

## 6. Smoke Tests
- `POST /runs` (confidential + standard) returns IRAC payload with allowlisted citations.
- `GET /search-local` returns ≥1 snippet for seeded prompt.
- `GET /admin/org/:id/operations/overview` shows latest performance snapshot.
- Frontend manual: install PWA, toggle confidential mode, submit Rwanda prompt, verify banners.

## 7. Rollback Strategy
- Application: `git revert <deploy commit>` + redeploy container image.
- Database: restore latest Supabase PITR snapshot; reapply migrations cautiously (dry-run first).
- Vector store: detach newly attached files and reattach previous snapshot ID (recorded before deploy via `pnpm ops:vector-store --dry-run`).
- Communicate via incident channel; postmortem required within 48h.

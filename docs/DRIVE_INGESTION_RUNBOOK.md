# Google Drive Ingestion Runbook

## Overview
The Drive ingestion pipeline synchronises curated legal sources into the authorities vector store. The pipeline is additive and enforces manifest validation before any content is indexed.

## Pipeline Steps
1. **Watch Registration** — Renew Drive push notifications daily via `apps/edge/drive-watch` worker.
2. **Manifest Validation** — Ensure each record matches the schema (`file_id`, `juris_code`, `source_type`, etc.). Invalid entries are quarantined.
3. **Normalization** — Convert PDFs/HTML into text with anchors; OCR is invoked for scanned artefacts.
4. **Summarisation** — Generate structured abstracts (`legal_abstract`, `case_holding`, `article_outline`).
5. **Chunk & Embed** — Chunk by article/paragraph, embed, and upload to OpenAI Vector Store (authorities-store).
6. **Mirroring** — Persist source metadata to Supabase tables (`sources`, `documents`, `document_chunks`).
7. **Post-Processing** — Link ingestion events to matters, update allowlist, and emit audit events.

## Monitoring
- Supabase `tool_telemetry` table for ingestion success/failure counts.
- Observability dashboard: latency + error rate per ingestion stage.
- Alerts triggered when quarantine backlog exceeds SLA or vector store status != READY.

## On-Call Playbook
1. **Failure in Manifest Validation** — Contact content ops, request manifest fix, and requeue job.
2. **Embedding Failures** — Retry up to 3 times; if still failing, failover to backup embedding model and notify platform team.
3. **Vector Store Timeout** — Pause ingestion, inspect OpenAI status page, and re-run backlog when healthy.
4. **Supabase Mirror Drift** — Execute reconciliation script `supabase/maintenance/reconcile-drive.ts`.

## Backout Procedure
- Disable Drive ingestion via feature flag `DRIVE_INGESTION_ENABLED` (config in ops secrets manager).
- Stop `drive-watch` and `ingestion-jobs` edge workers via deployment toggles.
- Revert to last known good vector store snapshot if corruption detected.

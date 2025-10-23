# PDF File Inputs Workflow

## Purpose
The PDF File Inputs workflow captures how evidence uploaded by users, matter teams, or Drive synchronisation lands in the agent runtime. It documents intake requirements so platform migrations keep parity with today’s upload paths.

## Intake Flow
1. **Collection** – Users drag/drop files or forward email inbox attachments. Drive jobs append authoritative sources (statutes, rulings) on a nightly cadence.
2. **Normalization** – Every PDF or image is normalised into text with anchors; OCR is triggered for scanned artefacts. Checksums and file metadata are recorded before we hand off to downstream tools.
3. **Safety & Tagging** – Uploads receive jurisdiction, confidentiality, and guardrail tags to enforce policy routing. Invalid or ambiguous inputs are quarantined for review.
4. **Vectorisation** – Text is chunked and embedded into the relevant OpenAI vector store (authorities, finance tax, audit, etc.) while Supabase mirrors store source metadata.
5. **Agent Consumption** – Agents reference tagged vector stores or direct file handles via File Search. Request tags (`OpenAI-Request-Tags`) keep provenance intact across runs.

## Migration Notes
- Maintain the quarantine + audit trail tables so reviewers can trace every document lifecycle event.
- Ensure ChatKit session transcripts link back to the file IDs surfaced in Evidence Inbox UI.
- Align guardrail bundles with intake tags (e.g., `policy=fr_judge_v1`, finance confidentiality variants) before enabling autonomous commands.
- Re-run ingestion smoke tests after Agent Platform imports to confirm File Search resolves the migrated dataset IDs.

## Implementation Reference
- **API intake** – `/apps/api/src/routes/upload/index.ts` stores upload metadata in Supabase (`documents`, `upload_ingestion_jobs`) and issues signed URLs for direct browser uploads while capturing guardrail tags and residency routing.
- **Background processing** – `/apps/api/src/routes/upload/worker.ts` promotes pending jobs by updating `documents.vector_store_status`, records completion/failure telemetry, and skips execution in test environments.
- **Dashboard surfacing** – `/apps/api/src/routes/corpus/data.ts` aggregates allowlist domains, upload jobs, and residency policies so the Corpus UI mirrors the live Supabase state.

## Verification Checklist
1. **Signed upload URL** – Call `POST /api/upload` with `x-org-id`, `x-user-id`, and a PDF payload; confirm the response includes a `upload.url` + `upload.token` pair and that `upload_ingestion_jobs.status` is `pending` (or `quarantined` when guardrails fire).
2. **Vector sync** – Trigger the ingestion worker (`processUploadQueue` in `upload/worker.ts`) and verify the corresponding document row now has `vector_store_status = uploaded` and a non-null `vector_store_synced_at` timestamp.
3. **Dashboard parity** – Fetch `GET /api/corpus?orgId=...` with `x-user-id`; ensure the new upload appears under `uploads` with the right residency zone and that `ingestionJobs` reflects progress/quarantine notes for the PDF.

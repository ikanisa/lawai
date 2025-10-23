# File Inputs (PDF) – Agent Resource Guide

This guide explains how we prepare, validate, and register PDF artefacts so hosted file search and future document tools remain reliable across agents.

## Scope
- Official statutes, rulings, and guidance PDFs curated for the authorities vector store.
- Finance agent artefacts (tax notices, audit workpapers, AP invoices) staged for upcoming agents.
- Any PDF uploaded through ChatKit sessions or orchestrator workflows that must be discoverable by the Agent Platform.

## Preparation Workflow
1. **Source Verification** – Confirm provenance (official portal URL, publication date, jurisdiction) and record it in the ingestion manifest.
2. **Normalization & OCR** – Convert PDFs to structured text; invoke OCR for scans so key sections remain searchable. Capture the text and original binary in Supabase Storage.
3. **Metadata Tagging** – Populate jurisdiction, document type, effective date, and version metadata before uploading. Use consistent naming to map back to vector store entries.
4. **Chunking & Embedding** – Run the ingestion job so content lands in the relevant OpenAI vector store (authorities or finance-specific) with stable chunk IDs.
5. **Registration** – Update Agent Platform resources (vector stores, datasets) with the new PDF batch and log the resource ID in the relevant checklist.

## Validation Checklist
- [ ] PDF renders correctly in browser preview and OCR extracted text is legible.
- [ ] Jurisdiction and document-type tags match taxonomy referenced by prompts.
- [ ] Vector store sync reports status `READY`; retry ingestion if background jobs fail.
- [ ] Supabase mirrors (`documents`, `document_chunks`) contain matching record counts.
- [ ] Agent runbooks updated with resource IDs and manifest changes.

## Troubleshooting
- **Skipped Files** – Re-run OCR pipeline; ensure binary is not encrypted or password-protected.
- **Vector Store Drift** – Execute reconciliation script (`supabase/maintenance/reconcile-drive.ts`) and re-ingest missing chunks.
- **Incorrect Metadata** – Update manifest entry and rerun ingestion so downstream evaluations use correct taxonomy.

Keep this guide close to the agent inventory and phase plans so every rollout considers PDF readiness.

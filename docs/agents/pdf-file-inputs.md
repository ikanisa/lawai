# PDF File Inputs Enablement Runbook

## Overview
This runbook documents the steps for enabling PDF ingestion for finance and legal corpora across the agent platform. It coordinates ingestion pipeline readiness, storage guardrails, and evaluation sign-off so that downstream agents can safely consume uploaded and hosted PDF sources.

## Responsible Team
- **Primary Owner:** Document Ingestion Guild (Data Platform)
- **Supporting Partners:** Finance Agent Working Group, Compliance Operations

## Prerequisites
- Supabase storage bucket with residency tagging configured per jurisdiction.
- Vector store slots provisioned for the target corpus (e.g., `OPENAI_VECTOR_STORE_FINANCE_AP`).
- OCR/embedding pipeline container images published to the registry.
- Access to governance dashboards for residency and consent attestation.

## Implementation Steps
1. **Enable Storage Flows:**
   - Create or validate the Supabase bucket for PDF uploads with residency enforcement flags.
   - Register lifecycle policies to auto-quarantine files that fail virus scanning or compliance checks.
2. **Provision Processing Pipeline:**
   - Deploy the OCR/extraction worker with PDF parsing support and French/OHADA language models enabled.
   - Configure chunk sizing (`chunk_char_limit`, overlap) and metadata capture (jurisdiction, document type) per runbook defaults.
3. **Wire Vector Store Synchronisation:**
   - Schedule the ETL job that publishes extracted chunks to the appropriate OpenAI vector store IDs.
   - Validate index health metrics (ingested chunk count, embedding success rate ≥ 99%).
4. **Instrument Guardrails:**
   - Attach compliance guardrail bundles for France analytics and OHADA acknowledgements to the ingestion pipeline events.
   - Ensure logging emits `policy=fr_judge_v1` and relevant finance guardrail tags for observability.
5. **Complete QA & Sign-Off:**
   - Run regression prompts using the finance PDF evaluation suite and log precision/recall results.
   - Present results to Compliance Operations for approval and record the sign-off in the Go/No-Go tracker.

## Success Criteria Checklist
- ✅ PDF ingestion pipeline deployed in production with monitoring dashboards green for 24h.
- ✅ ≥ 99% ingestion success rate across sampled PDF batches.
- ✅ Residency and compliance guardrail logs attached to every PDF ingestion event.
- ✅ Finance agent evaluation suite meets baseline precision/recall thresholds post-ingestion.
- ✅ Go/No-Go tracker updated with Document Ingestion Guild sign-off.

## Rollback Plan
- Pause the ingestion worker deployment via CI/CD.
- Revert vector store updates using the latest nightly snapshot.
- Notify Compliance Operations and Finance Agent Working Group, documenting the rollback reason and next steps.

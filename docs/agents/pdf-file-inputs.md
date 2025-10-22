# PDF File Inputs Rollout Guide

## Overview
This guide documents the controls and sequencing required to introduce new PDF corpora into the finance agent suite while preserving provenance, compliance, and ingestion reliability.

## Rollout Process
1. **Source curation & tagging** – Confirm document ownership, residency constraints, and retention windows. Apply standard metadata schema (`jurisdiction`, `document_type`, `effective_date`) before upload.
2. **Staging ingestion dry-run** – Use the ingestion orchestrator to process a representative sample in the staging vector store, recording parse fidelity metrics and redacting sensitive payloads that fail OCR or policy screening.
3. **Validation & QA sign-off** – Route extracted chunks through automated policy checks and manual reviewer spot-audits. Log issues in the ingestion tracker and verify remediation prior to production promotion.
4. **Production enablement** – Promote the approved dataset to production stores, backfill embeddings, and broadcast completion via the operations channel with updated guardrail mappings.

## Success Criteria
- ≥95% successful parsing across the pilot corpus with structured metadata populated for every document.
- Zero unresolved P0 compliance or residency violations at the time of production promotion.
- Automated regression checks scheduled nightly to monitor parse drift and compliance regressions.

## Responsible Team
- **Data Platform & Ingestion Team** – Owns ingestion tooling, dry-run execution, QA workflows, and production cutover communication.
- **Finance Agent PMO** – Tracks adoption milestones and aligns roadmap updates with platform guardrails.

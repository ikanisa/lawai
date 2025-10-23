# Reinforced RAG – Learning Overview

The learning loop monitors production signals, diagnoses regressions, proposes adjustments, and evaluates them before activation.

## Stages

1. **collect_signals** – `learning-collector` edge function captures agent runs, citations, tool telemetry, HITL outcomes, and user feedback. All signals are stored in `learning_signals` with org RLS.
2. **diagnose_gaps** – `learning-diagnoser` aggregates metrics into `learning_metrics` and emits `agent_learning_jobs` when thresholds are breached.
3. **generate_tickets** – jobs describe required actions (`guardrail_tune`, `synonyms_needed`, `canonicalizer_update`, `denylist_update`).
4. **apply_changes** – (P1) approvers review proposed changes, update `query_hints`, `citation_canonicalizer`, `denylist_deboost`, and increment `agent_policy_versions`.
5. **evaluate_and_gate** – nightly eval suites ensure SLOs hold; regressions trigger rollback and alerting.

## Data Stores

| Table | Purpose |
| --- | --- |
| `learning_signals` | Raw learning signals (source, kind, payload) per org. |
| `learning_metrics` | Aggregated metrics (allowlisted ratio, dead-link rate, etc.). |
| `query_hints` | Retrieval hints keyed by jurisdiction/topic (policy-controlled). |
| `citation_canonicalizer` | URL normalization patterns. |
| `denylist_deboost` | Domain/site deboost and hard denylists. |

## Jobs & Scheduling

| Function | Frequency | Responsibility |
| --- | --- | --- |
| `learning-collector` | every 10 minutes | Pull signals from telemetry tables. |
| `learning-diagnoser` | every 30 minutes | Compute metrics & emit jobs. |
| `learning-applier` | hourly (P1) | Apply approved changes & log policy versions. |
| `evaluate-and-gate` | nightly (P1) | Execute eval suite, gate changes. |
| `citator-recompute` | nightly (P1) | Refresh case treatments & scores. |

## Admin Console

- **Learning overview** – SLO snapshots (allowlisted precision, dead-link rate) and recent signals.
- **Proposed changes** (P1) – review queue for synonyms, hints, canonicalizer, denylist modifications.
- **Policy versions** (P1) – history, diff, rollback button.

## Related Guides

- [Semantic search quickstart](./LEARNING_SEMANTIC_SEARCH.md#quickstart) – triage ingestion and retrieval issues in minutes.
- [Tuning embedding coverage](./LEARNING_SEMANTIC_SEARCH.md#tune-embedding-coverage) – refresh corpora and validate updated citations.
- [Ranking diagnostics](./LEARNING_SEMANTIC_SEARCH.md#ranking-diagnostics) – compare similarity distributions and clickthrough health.


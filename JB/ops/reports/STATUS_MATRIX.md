# Implementation Status Matrix

| Plan Area | Owner | Key Artifact(s) | Status | Notes |
| --- | --- | --- | --- | --- |
| Foundation & Environment | Platform | db/migrations/0001_extensions.sql, db/migrations/0005_rls.sql | PASS | pgvector/pg_trgm enabled, org+RLS schema enforced as required. |
| Foundation & Environment | Platform | db/migrations/0007_storage.sql | PASS | Private buckets with per-org policies provisioned for authorities/uploads/snapshots. |
| Foundation & Environment | Platform | apps/ops/src/vector-store.ts, .env.example | PASS | Vector store bootstrap + env scaffolding provided for authorities corpus sync. |
| Foundation & Environment | Platform | .github/workflows/ci.yml | PASS | CI installs deps, runs lint/test/migrations, spins stub API for eval harness. |
| Data Ingestion & Provenance | Data | apps/edge/crawl-authorities/index.ts | PASS | Edge function normalises OHADA/EU/Maghreb/FR-BE-LU-CH-QC sources, hashes uploads, tracks ingestion runs. |
| Data Ingestion & Provenance | Data | apps/ops/src/vector-store.ts | PASS | CLI synchronises Supabase storage snapshots into OpenAI vector store and local pgvector mirror. |
| Data Ingestion & Provenance | Data | apps/edge/drive-watcher/index.ts, db/migrations/0015_drive_manifests.sql | PASS | Drive manifest validator and ingestion logging deployed with scheduled runs. |
| Data Ingestion & Provenance | Data | apps/edge/crawl-authorities/index.ts, db/migrations/0033_document_summaries.sql, apps/api/src/server.ts | PASS | Crawler now generates structured summaries/outlines, refreshes pgvector chunks, and surfaces coverage metrics (ready/pending/failed/skipped) in the governance dashboard. |
| Agent Orchestration & Tools | Backend | apps/api/src/agent.ts | PASS | Agents SDK orchestrator uses web/file search tools, guardrails, hybrid retrieval, RLS-backed persistence. |
| Agent Orchestration & Tools | Backend | apps/api/src/agent.ts | PASS | Hosted tools plus routing, deadline, limitation, OHADA, interest, citation validation, snapshot, and pleading template functions available. |
| Retrieval & Evaluation | Ops | apps/api/src/agent.ts, db/migrations/0006_rpc.sql | PASS | Hybrid retrieval via match_chunks RPC plus File Search pre-context wired. |
| Retrieval & Evaluation | Ops | apps/ops/src/evaluate.ts, db/migrations/0071_org_evaluation_metrics.sql, apps/api/src/server.ts, apps/web/src/components/admin/admin-view.tsx | PASS | Evaluation CLI records precision/temporal telemetry, enforces link-health tolerances from provenance metrics, and dashboards surface coverage and Maghreb banner compliance par juridiction. |
| Operator Console & HITL | Frontend | apps/web/src/components/**/* | PASS | Workspace, Research, Drafting, Matters, Citations, HITL, Corpus, Admin screens implemented with FR default and accessibility affordances. |
| Operator Console & HITL | Backend | apps/api/src/server.ts | PASS | REST endpoints for runs, workspace, citations, HITL queue/actions, corpus, matters exposed with Supabase backing. |
| Operator Console & HITL | Frontend | apps/web/src/components/citations/citations-browser.tsx | PARTIAL | Authority browser lacks interactive version diff/highlight compared to plan requirement. |
| Governance & Compliance | Ops | db/migrations/0011_agent_learning.sql, apps/edge/process-learning/index.ts | PASS | Policy version APIs, synonym feedback automation, and Confidential Mode enforcement complement the existing learning jobs and governance docs. |
| Launch & Operations | Ops | README.md, docs/implementation_status_report.md | PARTIAL | Runbooks seeded but no pilot onboarding playbook, SLO metrics, or marketing collateral shipped. |
| Ready-for-Production Checklist | PMO | docs/avocat_ai_bell_system_plan.md | FAIL | Checklist items for Drive ingestion, governance docs, evaluations remain unchecked; no verification artifacts. |

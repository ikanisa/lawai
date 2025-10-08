# Production Readiness Roadmap

## Overview
The Avocat-AI Francophone codebase now includes the BELL production plan, core Supabase schema with RLS, ingestion stubs, learning tables, and agents orchestration, but substantial scope across ingestion, compliance, UI, and governance remains incomplete. This roadmap consolidates the outstanding workstreams and sequences them into milestones so the team can reach the launch criteria defined in the BELL plan and Go/No-Go checklist.【F:docs/avocat_ai_bell_system_plan.md†L41-L200】【F:docs/implementation_status_report.md†L1-L210】【F:ops/reports/GO_NO_GO_CHECKLIST.md†L1-L73】

## Workstream Status Snapshot
| Workstream | Current Coverage | Remaining Gaps |
| --- | --- | --- |
| Foundation & Environment | Supabase extensions, tenancy tables, storage policies, CI flow, and ops scripts for migrations/vector store provisioning exist.【F:supabase/migrations/20240101000100_extensions.sql†L1-L3】【F:supabase/migrations/20240101000200_auth_orgs.sql†L1-L33】【F:.github/workflows/ci.yml†L1-L78】【F:apps/ops/src/provision.ts†L1-L48】 | Need residency-aware storage zoning, automated secret rotation, RBAC×ABAC middleware, SSO/SCIM/MFA/IP enforcement, consent capture, Confidential/France modes, and lawful basis matrices as mandated by the plan.【F:docs/avocat_ai_bell_system_plan.md†L55-L126】 |
| Data Ingestion & Provenance | Edge function fetches Légifrance/OHADA/Rwanda fixtures, normalises metadata, writes to storage/vector store when configured.【F:apps/edge/crawl-authorities/index.ts†L1-L360】 | Missing real connectors for Legilux, Moniteur/Justel, Fedlex, LégisQuébec/CanLII, Maghreb gazettes; no ELI/ECLI/Akoma Ntoso capture, cron schedules, change detection, or provenance dashboards.【F:docs/avocat_ai_bell_system_plan.md†L76-L140】 |
| Agent Orchestration & Tools | Agents SDK orchestrator with Web/File Search, jurisdiction/deadline/OHADA tools, allowlist guardrails, case scoring telemetry, and HITL queue hooks is in place.【F:apps/api/src/agent.ts†L430-L1150】【F:apps/api/src/case-quality.ts†L1-L159】 | Lacks FRIA checkpoints, CEPEJ charter tests, Council of Europe treaty disclosures, deterministic planner/executor/verifier separation, and production trust signals driven by live citator data.【F:docs/avocat_ai_bell_system_plan.md†L72-L208】 |
| Retrieval & Evaluation | Hybrid retrieval uses File Search + `match_chunks`; evaluation CLI logs metrics to Supabase et charge les jeux LegalBench/LexGLUE avec métadonnées de benchmark.【F:apps/api/src/server.ts†L189-L236】【F:apps/ops/src/evaluate.ts†L1-L340】 | Citation fidelity dashboards, link-health monitors automatisés et le module public “Why trust this” restent à livrer.【F:docs/avocat_ai_bell_system_plan.md†L209-L260】 |
| Front-End & HITL | No Next.js/shadcn implementation yet; UI requirements only documented.【F:docs/avocat_ai_bell_system_plan.md†L261-L351】 | Need full App Router app, mobile PWA UX, voice/OCR capture, diff viewers, HITL console, export flows, telemetry, WCAG 2.2 AA compliance, and confidential-mode hardening.【F:docs/avocat_ai_bell_system_plan.md†L261-L351】 |
| Learning & Continuous Improvement | Learning tables, tool telemetry, and ticket generation exist; l’edge function traite les tickets et consigne dérive/évaluations/équité dans `agent_learning_reports`.【F:supabase/migrations/20240101001200_agent_learning.sql†L1-L94】【F:apps/edge/process-learning/index.ts†L1-L438】 | Reste à activer les versions de politiques, enrichir les synonymes côté planner et exposer des tableaux de bord d’équité aux opérateurs.【F:docs/avocat_ai_bell_system_plan.md†L166-L178】 |
| Governance & Launch Ops | Responsible-AI, conflict, retention, incident, change-management docs drafted; Go/No-Go checklist published.【F:docs/governance/responsible_ai_policy.md†L1-L64】【F:ops/reports/GO_NO_GO_CHECKLIST.md†L1-L73】 | Need CEPEJ charter mapping, Council of Europe treaty alignment, FRIA templates/logs, residency/DPIA matrices, transparency reports, pilot onboarding collateral, SLO dashboards, pricing assets, and evidence capture for each checklist item.【F:docs/avocat_ai_bell_system_plan.md†L342-L377】 |

## Milestone Plan
The roadmap spans four delivery waves (M0–M3) plus a launch gate. Dependencies are sequenced to unblock ingestion and orchestration before UI, then compliance and launch prep.

### M0 – Infrastructure Hardening (Weeks 0-4)
- Automate Supabase environment conformance (extensions check, storage buckets, residency prefixes, secret audit) and vector store bootstrap within CI/CD.【F:docs/avocat_ai_bell_system_plan.md†L55-L70】
- Implement RBAC×ABAC middleware reading `org_policies` and `jurisdiction_entitlements`; enforce Confidential Mode and France judge-analytics policy in API and tools.【F:docs/avocat_ai_bell_system_plan.md†L62-L74】【F:supabase/migrations/20240101002700_user_management.sql†L1-L78】
- Finalise ingestion adapters for Legilux, Moniteur/Justel, Fedlex/TF, LégisQuébec/CanLII, Maghreb gazettes, Rwanda OG; add ELI/ECLI normalization and Akoma Ntoso serialization; schedule crawls via Supabase Cron with ETag/hash diffing.【F:docs/avocat_ai_bell_system_plan.md†L76-L140】【F:apps/edge/crawl-authorities/index.ts†L361-L640】
- Extend learning workers to process indexing/query-rewrite tickets hourly and emit nightly drift/eval reports tied to Supabase telemetry.【F:docs/avocat_ai_bell_system_plan.md†L166-L178】

### M1 – Agent Compliance & Retrieval (Weeks 5-8)
- Add EU AI Act FRIA gates, CEPEJ charter tests, Council of Europe treaty flags, and residency matrix checks to `/runs` workflow; persist FRIA artefacts and compliance decisions.【F:docs/avocat_ai_bell_system_plan.md†L186-L208】【F:docs/avocat_ai_bell_system_plan.md†L342-L359】
- Separate planner/executor/verifier pipeline with deterministic run keys, per-tool budgets, and expanded guardrail telemetry; integrate live case_treatments/risk_register feeds for trust panels.【F:docs/avocat_ai_bell_system_plan.md†L180-L199】【F:supabase/migrations/20240101002200_case_quality_schema.sql†L1-L88】
- Broaden evaluation suite with LegalBench/LexGLUE, citation fidelity dashboards, link-health monitoring, fairness drift alerts, and admin analytics exports.【F:docs/avocat_ai_bell_system_plan.md†L209-L260】

### M2 – Experience & Identity (Weeks 9-12)
- Ship the Next.js App Router console implementing workspace, research, drafting, matters, citations, HITL, corpus, and admin screens with PWA/mobile requirements, telemetry, and WCAG audits.【F:docs/avocat_ai_bell_system_plan.md†L261-L351】
- Integrate voice dictation, camera OCR, Outbox/offline flows, staleness chips, Workbox caching policies, push digests, and print/export polish as per mobile PWA checklist.【F:docs/avocat_ai_bell_system_plan.md†L323-L351】
- Deliver SSO/OIDC, SCIM provisioning, MFA/passkeys, IP allow-lists, consent logs, audit dashboards, and admin policy toggles tied to Supabase tables.【F:docs/avocat_ai_bell_system_plan.md†L62-L74】【F:docs/avocat_ai_bell_system_plan.md†L108-L154】

### M3 – Governance, Launch, and Performance (Weeks 13-16)
- Produce CEPEJ charter mapping, Council of Europe AI treaty alignment, GDPR/Rwanda/Malabo residency matrices, DPIA templates, FRIA logs, transparency report, and Council/TOJI-aligned responsible AI collateral.【F:docs/avocat_ai_bell_system_plan.md†L342-L377】
- Finalise pilot onboarding kit, change-management workflows, SLO dashboards, pricing collateral, and marketing enablement, ensuring Ops artifacts align with Go/No-Go checklist.【F:ops/reports/GO_NO_GO_CHECKLIST.md†L1-L73】
- Conduct performance hardening (latency budgets, Core Web Vitals, load/regression tests) and red-team exercises, iterating on guardrails and evaluations.【F:docs/avocat_ai_bell_system_plan.md†L142-L143】【F:docs/avocat_ai_bell_system_plan.md†L175-L178】

### Launch Gate (Post-M3)
- Run full Go/No-Go checklist with evidence (law/ethics, data provenance, retrieval scoring, tool registry, security, UX, telemetry, operations) and secure compliance sign-off before production cutover.【F:ops/reports/GO_NO_GO_CHECKLIST.md†L1-L73】
- Establish post-launch monitoring (monthly evaluations, policy/version change log, customer feedback loop) and schedule the first quarterly transparency update.【F:docs/avocat_ai_bell_system_plan.md†L34-L37】【F:docs/avocat_ai_bell_system_plan.md†L176-L178】

## Immediate Next Actions
1. Finalise ingestion adapters (Legilux, Moniteur/Justel, Fedlex, LégisQuébec/CanLII, Maghreb) and wire Supabase Cron with ETag/hash diffing.【F:docs/avocat_ai_bell_system_plan.md†L76-L140】
2. Implement RBAC×ABAC middleware enforcing Confidential/France modes, SSO/SCIM/MFA policies, and consent capture.【F:docs/avocat_ai_bell_system_plan.md†L62-L74】
3. Extend learning processors for hourly ticket sweeps and nightly drift/eval reports.【F:docs/avocat_ai_bell_system_plan.md†L166-L178】
4. Draft CEPEJ/FRIA governance artefacts and residency matrix to unblock compliance gating work in M1.【F:docs/avocat_ai_bell_system_plan.md†L186-L208】【F:docs/avocat_ai_bell_system_plan.md†L342-L359】

This roadmap should be reviewed after each milestone to confirm scope completion, update dependencies, and prepare evidence for the Go/No-Go release gate.

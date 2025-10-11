# Autonomous Justice Suite – Implementation Plan

## Vision & Guiding Principles
- Deliver an autonomous, statute-first legal assistant for Francophone jurisdictions with strict governance and audit controls.
- Ship iteratively in production-ready slices, validating compliance, data residency, and HITL requirements at every phase.
- Maintain bilingual UX (FR/EN/RW) and enforce Maghreb/Rwanda language notices, OHADA pre-emption, and France judge-analytics bans end-to-end.

## High-Level Timeline
| Phase | Focus | Primary Outcomes |
| --- | --- | --- |
| **0. Foundations** (complete) | Stabilise migrations, CI tooling | Idempotent Supabase migrations, backfill tooling, ops tests passing |
| **1. Core Access & Agents** | Access middleware, orchestrator + core agents | ABAC/permissions, concierge & research/ OHADA agents, policy enforcement |
| **2. Data & Ingestion Layer** | Corpus ingestion + learning telemetry | Drive pipeline, quarantine, canonicalisers, treatment graph rebuilds, learning metrics |
| **3. Agent Desk & Process Navigator** | Front-end UX surfaces | Agent desk shell, plan drawer, quick actions, Process Navigator skeleton |
| **4. Drafting & Evidence Workflows** | Drafting studio, evidence inbox, citations browser | Redline flows, evidence intake, authority browser, admin console |
| **5. Compliance & Ops Automation** | Governance dashboards, scheduled jobs | CEPEJ metrics, evaluation coverage, regulator digests, SLO reporting |
| **6. Launch Hardening** | QA, trust panels, docs | Acceptance checklists, trust scoring overlays, DR drills |

Each phase delivers production-ready increments with integration tests, documentation, and rollout playbooks.

---

## Phase Details & Workstreams

### Phase 1 – Core Access & Agent Orchestrator
**Objectives**: Enforce RBAC×ABAC, stand up orchestrator (`concierge`) and two primary specialists (`conseil_recherche`, `ohada`) with guardrails.

**Workstreams**
1. **Access & Policy Engine**
   - Extend `apps/api` middleware to enforce role matrix & ABAC attributes (jurisdiction entitlements, confidential mode, residency, sensitive topic HITL).
   - Implement consent & Council of Europe disclosure gating (policies.manage).
   - Harden judge analytics ban / statute-first enforcement in agent pipeline.
2. **Agent Directory & Settings**
   - Load manifest from `@avocat-ai/shared` (user types, permissions, tools).
   - Implement agent settings schema: defaults + per-agent overrides, persisted in Supabase (`agent_policy_versions`).
3. **Concierge Orchestrator**
   - Intent detection, jurisdiction routing, plan generation, tool budgeting, HITL triggers.
   - Deterministic plan output for transparency (no chain-of-thought exposure; plan drawer ready).
   - Supabase backed `orchestrator_sessions`/`commands`/`jobs` + safety gating APIs now live (`/agent/commands`, `/agent/jobs/*`, `/agent/connectors`).
4. **Research & OHADA Agents**
   - Statute-first retrieval, case scoring, OHADA pre-emption banners, Maghreb language flags.
   - Tool adapters: `file_search`, `web_search`, `lookupCodeArticle`, `ohadaUniformAct`, `validateCitation`, `deadlineCalculator`.
5. **API Endpoints & Tests**
   - `/agents/run`, `/research/irac`, `/ohada/preemption`, `/citations/validate`, `/deadlines/compute`.
   - Vitest suites covering access scenarios, guardrails, tool success/failure, HITL escalation.
6. **Telemetry & Auditing**
   - Record tool usage, guardrail events, HITL triggers in `agent_learning_jobs` + `audit_events`.
   - Update docs: access policies, agent manifest, troubleshooting.

**Acceptance**
- Passing integration tests for agent runs in FR/OHADA contexts.
- Access denied for unauthorised roles/tools; HITL triggered per policy.
- Plan drawer surfaces agent plan in UI stub (placeholder JSON served).
- Finance capability manifest exposé via `/agent/capabilities` avec couverture des connecteurs (Tax/AP/Audit/CFO/Risque/Réglementaire) pour alimenter Director et Safety.

### Phase 2 – Data & Ingestion Layer
**Objectives**: Build secure corpus ingestion, treatment graphs, and learning telemetry.

**Workstreams**
1. **Supabase Schema Extensions**
   - Finalise tables: `case_treatments`, `learning_signals`, `learning_metrics`, `query_hints`, `citation_canonicalizer`, `denylist_deboost`, `gdrive_state`, `ingestion_quarantine`.
   - RLS policies with `public.is_org_member`, residency controls, quarantine access.
2. **Drive Watcher & Quarantine**
   - Edge function monitoring shared drive folder; manifest validation; OCR pipeline.
   - Quarantine rules (non-allowlisted domains, missing dates, translation without binding language).
3. **Normalization & Embedding**
   - Summarisation, chunking (statutes/cases/gazettes), embedding via OpenAI + Supabase mirror.
   - Residency tagging, metadata extraction (binding language, court rank, effective dates).
4. **Treatment Graph Builder**
   - Nightly jobs building citation edges via fixtures + ingestion; rebuild queue.
   - Case quality metrics updates; risk overlays (denylist, political risk).
5. **Learning & Telemetry Loop**
   - Collect signals (tool usage, citations, routing), enqueue diagnostics, apply policy updates.
   - Metrics (allowlisted ratio, temporal validity, Maghreb banner coverage, fairness data).
6. **Ops Tooling & Docs**
   - CLI commands for ingestion status, treatment graph rebuild, quarantine review.
   - Documentation: ingestion pipeline, residency enforcement, troubleshooting.

**Acceptance**
- Drive ingestion end-to-end with quarantine + approval flows.
- Treatment graph data accessible in API/learning jobs.
- Learning metrics populated; webhooks/triggers audited.

### Phase 3 – Agent Desk & Process Navigator
**Objectives**: Deliver core UI shell with agent plan visibility and guided playbooks.

**Workstreams**
1. **Agent Desk Shell**
   - Layout: chat viewport, action bar (Ask/Do/Review/Generate), plan drawer, evidence pane.
   - Tool chips with status badges; quick actions (deadline, draft, cite-check, bundle exhibits).
2. **Plan Drawer Integration**
   - Consume orchestrator plan; show steps, tools, status without CoT.
   - Highlight HITL triggers, tool budgets, reused runs.
3. **Evidence Pane & Case Scores**
   - Surface citations with badges (Official/Consolidated/Translation/Jurisprudence), case score axes.
   - Staleness chips, refresh actions, download/export controls.
4. **Process Navigator Skeleton**
   - Guided flows for Civil Claim (FR), OHADA debt recovery, Employment dismissal, OHADA company formation, Rwanda example.
   - Stepper with forms, required facts, auto-generated documents per step.
5. **Localization & Accessibility**
   - FR/EN toggles, Rwanda (RW) support, WCAG 2.2 AA compliance, prefer-reduced-motion.
6. **Testing & Docs**
   - Playwright/Storybook coverage for core components.
   - UX documentation, design tokens, theming guidelines.

**Acceptance**
- Working desktop UI: complete agent run from ask → plan → evidence.
- Process Navigator flows accessible and localised.
- Plan drawer & evidence pane reflect backend responses.

### Phase 4 – Drafting & Evidence Workflows
**Objectives**: Implement drafting studio, evidence inbox, citations browser, admin console.

**Workstreams**
1. **Drafting Studio**
   - Live redlining, clause benchmarks, accept/reject with rationale and sources.
   - Template generation, fill-ins, timeline integration.
2. **Evidence Inbox**
   - Drive intake dropzone, OCR status, link evidence to matters, anchor references.
   - Confidential mode: disable caching, blur previews, enforce residency.
3. **Citations Browser**
   - Authority search, version diff, OHADA tab, bindings, translations.
   - ELI/ECLI normalisation, treatment graph visual hints.
4. **Admin Console**
   - Manage people, policies, entitlements, Drive status, residency zones.
   - Consent management, device registry, audit log viewer.
5. **PWA Mobile Enhancements**
   - Bottom navigation, offline outbox, camera OCR, voice input, sticky HITL CTA.
   - Push notifications, staleness warnings, install prompts.
6. **Testing & Docs**
   - E2E flows covering drafting, evidence linking, admin actions.
   - User guides for attorneys, admins, compliance roles.

**Acceptance**
- End-to-end drafting & evidence flows operational in desktop + PWA contexts.
- Citations browser exposes trusted sources and binding notices.
- Admin console controls policies, entitlements, Drive status.

### Phase 5 – Compliance & Ops Automation
**Objectives**: Governance dashboards, scheduled jobs, red-team/performance automation.

**Workstreams**
1. **Metrics Dashboards**
   - CEPEJ metrics, evaluation coverage (Maghreb, Rwanda), governance summaries.
   - Trust panels with case scores, treatment graph overlays.
2. **Scheduled Jobs & Reports**
   - Daily learning cycle, regulator digest, transparency reports, SLO snapshots.
   - Ops CLI updates: red team, performance, vector re-embed, policy rotation.
3. **HITL & Fairness Monitoring**
   - HITL dashboard (queue, response times, fairness metrics), bias insights.
   - Alerts for allowlist compliance, temporal validity, fairness thresholds.
4. **Compliance Artefacts**
   - FRIA dossier automation, Go/No-Go evidence, incident/change logs, transparency exports.
   - Residency enforcement audits, secret rotation hooks, RLS smoke tests.
5. **Documentation & Training**
   - Governance playbooks, DR drills, compliance checklist updates.
   - Training materials for operators, compliance officers, regulators.

**Acceptance**
- Dashboards accessible with accurate data; alerts trigger when thresholds breached.
- Automated reports delivered on schedule; CLI outputs up-to-date.
- Compliance documentation ratified by stakeholders.

### Phase 6 – Launch Hardening & Acceptance
**Objectives**: Final QA, trust overlays, documentation, drills.

**Workstreams**
1. **Trust & Verification**
   - Trust panel overlays in Agent Desk; treatment graph link-out; audit trails.
   - C2PA signing for exports; transparency reports.
2. **Performance & Security Testing**
   - Load tests, guardrail validation, red-team regression.
   - Security review, penetration test remediation.
3. **Docs & Training**
   - Final user manuals, quick-start guides, compliance playbooks.
   - Training sessions for operators, legal reviewers, compliance staff.
4. **DR & Observability Drills**
   - Full rollback drills, backup verification, incident response playbooks.
   - Observability dashboards (logs, metrics, traces) with runbooks.
5. **Launch Readiness Review**
   - Acceptance checklist sign-off, Go/No-Go evidence complete.
   - Deployment playbooks, monitoring alerts defined.

**Acceptance**
- All acceptance criteria met; stakeholders sign off on launch.
- Post-launch monitoring and ops processes active.

---

## Immediate Next Steps
1. Confirm Phase 1 priorities (access middleware + orchestrator + research/OHADA agents).
2. Create phase-specific backlog with engineering owners, design/compliance reviews, timelines.
3. Start Phase 1 development with daily checkpoints and integration tests.
4. Prepare supporting documentation and ops readiness alongside development.

This plan is the execution blueprint; each phase should include design reviews, compliance approvals, and retro to ensure alignment with the vision.

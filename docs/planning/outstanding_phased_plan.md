# Outstanding Implementation Plan

This plan sequences the remaining scope required to satisfy the Avocat-AI launch blueprint. Each phase lists the critical deliverables, owners (where known), and the key dependencies to unblock the subsequent phase.

## Phase 1 – Compliance Hardening & Residency Enforcement (Week 0–1)
- **Consent & disclosure UX:** Ship UI flows to capture CEPEJ/EU consent, Council of Europe disclosures, and automated treaty acknowledgements across agent run, export, and account management surfaces.
- **Residency-aware storage controls:** Finalise `org_residency_allows` enforcement in storage APIs, wire residency hints into client uploaders, and add smoke tests for disallowed cross-border storage and retrieval attempts.
- **Device & session registry:** Implement full-device telemetry with MFA/passkey attestation and IP allow-list management dashboards, emitting audit events for every session validation.
- **Planner/executor governance:** Complete deterministic run-key issuance, planner/executor separation safeguards, and CEPEJ charter regression tests inside CI.
- **Go/No-Go automation:** Extend the Go/No-Go checklist integration to auto-consume consent ledger updates, regulator digests, and FRIA validations, failing builds when governance evidence is stale.

## Phase 2 – Provenance Expansion & Retrieval Trust (Week 1–3)
- **ELI/ECLI/Akoma Ntoso enrichment:** Finish automated identifier extraction during ingestion, persist structured metadata, and expose diff views for operator validation.
- **PDF ingestion enablement milestone:** [Document Ingestion Guild](../agents/pdf-file-inputs.md) to ship finance corpus PDF ingestion with ≥99% pipeline success, residency/compliance telemetry, and post-rollout evaluation suite pass marks.
- **Maghreb/Rwanda live feeds:** Operationalise the polling workers, quarantine dashboards, and language-binding banners for these sources, ensuring cite-or-refuse enforcement in the agent pipeline.
- **Trust dashboards:** Deliver jurisdiction dashboards that combine link health, identifier coverage, Maghreb banner coverage, and case reliability scores with drill-down charts.
- **Benchmark coverage:** Broaden LegalBench/LexGLUE suites, add temporal validity checks, and wire precision/recall thresholds into CI gates with nightly fairness trend analytics.
- **Synonym & drift analytics:** Extend the learning worker to surface synonym intelligence, drift deltas, and reviewer feedback loops per jurisdiction, with alerts routed to the admin console.
- **PDF ingestion rollout:** Data Platform & Ingestion team to execute the staged adoption outlined in the [PDF file inputs rollout guide](../agents/pdf-file-inputs.md), achieving ≥95% parse fidelity on the finance pilot corpus with no unresolved P0 compliance issues before production cutover.

## Phase 3 – Agent Workflows, HITL, and Drafting Experience (Week 3–5)
- **Multi-agent desk completion:** Implement Process Navigator playbooks (civil claim FR, OHADA debt recovery, employment dismissal, OHADA company formation, Rwanda workflows) with telemetry and guardrails.
- **Specialist personas:** Add bench memo, procedural navigator, negotiation mediator, and evidence discovery personas with scoped tool permissions and compliance checks.
- **Drafting studio & matters workspace:** Build drafting editor, matters management, citation diff viewer, and corpus manager surfaces with ABAC enforcement and audit trails.
- **HITL review console:** Deliver reviewer queue actions (approve, escalate, request human review), trust-panel integration, and reviewer feedback analytics visualisations.
- **Command palette & tool chips:** Connect command palette, plan drawer, quick actions (deadlines, filings, cite-check, exhibit bundler), and trust panel across Ask/Do/Review/Generate modes.

## Phase 4 – Mobile PWA & Offline Readiness (Week 5–7)
- **PWA shell:** Implement bottom navigation, floating action button, reading modes (Research/Brief/Evidence), article anchors, voice dictation, and camera OCR integrations.
- **Offline outbox & staleness chips:** Build offline caching with Workbox, an outbox queue for pending actions, staleness indicators, and retry flows with telemetry.
- **Core Web Vitals budgets:** Instrument web vitals reporting with budgets, retention policies, and admin dashboards summarising CLS/LCP/FID budgets per tenant.
- **Confidential-mode UX:** Harden confidential-mode banners, Maghreb binding-language warnings, Rwanda toggles, and CEPEJ “user control” prompts across mobile and desktop.
- **C2PA export signing:** Extend signature manifest storage, verification UI, and regulator-ready export audit logs.

## Phase 5 – Launch Collateral & Operational Readiness (Week 7–8)
- **Transparency & regulator digests:** Automate regulator/SLO digests distribution, expose transparency dashboards, and schedule Council of Europe commitments broadcasts.
- **Pilot onboarding & training:** Publish pilot onboarding guides, training modules, pricing/support packs, and in-app onboarding tours aligned with consent requirements.
- **Production runbooks:** Finalise runbooks for incident response, residency audits, FRIA refresh, and multilingual support escalation, linking them into the Go/No-Go evidence trail.
- **Monitoring & alerting:** Wire KPI dashboards (retrieval precision, fairness drift, consent completion) into alerting pipelines with on-call rotations and escalation policies.
- **Post-launch analytics:** Enable feedback capture loops, NPS collection, and retention analytics with anonymised exports for compliance reporting.

## Cross-Cutting Dependencies
- Keep Supabase migrations, shared packages, and frontend components in sync via type-safe contracts.
- Require CI verification (lint, tests, e2e, vitals thresholds) before merge to avoid regressions.
- Maintain bilingual (EN/FR) localisation coverage for every new user-facing surface and audit log entry.
- Ensure every compliance artefact updates the Go/No-Go tracker and regulator digest feeds in near-real time.


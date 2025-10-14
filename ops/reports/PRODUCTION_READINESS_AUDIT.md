# Production Readiness Audit – Avocat-AI Francophone

## Executive Summary
The platform delivers extensive scaffolding—Supabase schema, Agents SDK orchestration, ingestion pipelines, governance tooling, and documentation—but critical launch blockers remain. Hybrid retrieval, learning telemetry, and governance automation are progressing, yet operator experience, compliance verification, and customer-facing readiness artifacts still lag the BELL implementation plan and Go / No-Go checklist expectations. Production launch should be deferred until the outstanding items below reach green status across infrastructure, data quality, agent behaviour, UI/UX, and operational governance.

## Readiness Scorecard
| Domain | Status | Rationale |
| --- | --- | --- |
| **Foundation & Environment** | ⚠️ *At Risk* | Supabase extensions, RLS, storage policies, and CI automation exist, but secret rotation, device registry telemetry, consent capture UI, and automated vector-store provisioning remain open before the environment can be signed off for regulated tenants.【F:docs/implementation_status_report.md†L21-L58】【F:docs/avocat_ai_bell_system_plan.md†L55-L166】 |
| **Authoritative Ingestion & Provenance** | ⚠️ *At Risk* | Edge crawlers cover EU, OHADA, Maghreb, and Rwanda sources with hashing and telemetry, yet Akoma Ntoso/ELI enrichment, Maghreb/Rwanda live feed hardening, and operator provenance dashboards are incomplete, risking citation fidelity commitments.【F:docs/implementation_status_report.md†L59-L110】【F:docs/avocat_ai_bell_system_plan.md†L62-L140】 |
| **Agent Orchestration & Guardrails** | ⚠️ *At Risk* | Agents SDK, retries, confidential mode, and France analytics bans are live, but CEPEJ automated tests, FRIA workflow completion, Council of Europe disclosures in product, and planner/executor separation still need verification before legal compliance sign-off.【F:docs/implementation_status_report.md†L111-L171】【F:docs/avocat_ai_bell_system_plan.md†L186-L260】 |
| **Hybrid Retrieval & Evaluations** | ✅ *On Track* | File Search + pgvector hybrid retrieval, evaluation CLI, LegalBench/LexGLUE fixtures, and link-health gating are operational; remaining work is incremental dashboard enrichment rather than a launch blocker.【F:docs/implementation_status_report.md†L172-L220】【F:docs/avocat_ai_bell_system_plan.md†L209-L260】 |
| **Operator Console & HITL UX** | ❌ *Not Ready* | Next.js App Router, mobile navigation, drafting/matters workflows, diff viewer, offline/PWA behaviours, C2PA exports, and CEPEJ user-control affordances remain outstanding, so no operator can safely pilot the agent yet.【F:docs/implementation_status_report.md†L221-L298】【F:docs/avocat_ai_bell_system_plan.md†L261-L351】 |
| **Governance, Compliance & Launch Ops** | ⚠️ *At Risk* | Governance documents, regulator digests, incident/change ledgers, and SLO telemetry are seeded, and the new operations overview route plus Trust Center expose Go / No-Go Section H evidence publicly. Remaining work covers transparency broadcasts, onboarding collateral, and SLA tooling before sign-off.【F:docs/implementation_status_report.md†L14-L26】【F:apps/api/src/server.ts†L2304-L2456】【F:apps/web/src/components/trust/trust-center-view.tsx†L1-L120】【F:ops/reports/GO_NO_GO_CHECKLIST.md†L1-L73】 |

## Outstanding Tasks by Workstream
### Foundation & Environment
- Automate vector-store provisioning/validation inside the ops bootstrap flow so every tenant has a ready File Search corpus.【F:docs/avocat_ai_bell_system_plan.md†L55-L104】
- Expose consent capture, session registry, MFA/passkey toggles, and IP allow-list editors in the operator console to satisfy enterprise identity objectives.【F:docs/avocat_ai_bell_system_plan.md†L105-L166】
- Ship device/session telemetry dashboards and complete the break-glass audit trail required by the user-management blueprint.【F:docs/implementation_status_report.md†L21-L58】

### Authoritative Ingestion & Provenance
- Implement Akoma Ntoso + ELI/ECLI enrichment for statutes and jurisprudence, storing structural anchors for downstream diffing.【F:docs/avocat_ai_bell_system_plan.md†L83-L140】
- Harden Maghreb and Rwanda crawlers with production credentials, live feed failover, and quarantine review tooling surfaced to operators.【F:docs/implementation_status_report.md†L59-L110】
- Build provenance dashboards in the console that visualise residency, binding-language coverage, and link-health regressions in real time.【F:docs/implementation_status_report.md†L59-L110】

### Agent Orchestration & Guardrails
- Automate CEPEJ ethical charter tests and EU AI Act FRIA checkpoints inside CI, blocking deployments when compliance artefacts are missing.【F:docs/avocat_ai_bell_system_plan.md†L186-L260】
- Surface Council of Europe treaty commitments, FRIA status, and consent disclosures directly in the operator UI and exported briefs.【F:docs/implementation_status_report.md†L111-L171】
- Finalise planner/executor/verifier separation with auditable prompts and produce certification evidence for regulator review.【F:docs/avocat_ai_bell_system_plan.md†L186-L260】

### Operator Console & HITL Experience
- Deliver all Appendix A screens (Workspace, Research, Drafting, Matters, Citations, HITL Review, Corpus, Admin) with mobile-first navigation, command palette, and voice/OCR capture.【F:docs/avocat_ai_bell_system_plan.md†L261-L327】
- Implement article-level anchors, diff viewer, staleness chips, Outbox/offline queues, push notifications, and confidential-mode UX safeguards mandated by the PWA checklist.【F:docs/avocat_ai_bell_system_plan.md†L328-L351】
- Integrate HITL review actions, audit trails, and reviewer SLA metrics into the console so escalation loops can be piloted end-to-end.【F:docs/implementation_status_report.md†L221-L298】

### Governance, Compliance & Launch Operations
- Publish DPIA, CEPEJ, and Council of Europe commitments via the public governance site and automate weekly transparency digests.【F:ops/reports/GO_NO_GO_CHECKLIST.md†L1-L73】
- Complete regulator-facing dashboards (SLO, incident response, change log) and align them with the Go / No-Go Release Checklist gates.【F:docs/implementation_status_report.md†L299-L377】
- Finalise onboarding collateral: pilot training decks, support playbooks, pricing collateral activation, and contractual appendices (DPA, SLA).【F:docs/avocat_ai_bell_system_plan.md†L342-L377】

## Phase-Based Remediation Plan
### Phase A – Environment & Compliance Hardening (Week 0–2)
1. Automate vector-store provisioning, secret rotation verification, and session/consent dashboards.
2. Integrate CEPEJ/FRIA automated tests into CI and expose compliance artefacts in the operator console.
3. Deliver Council of Europe, FRIA, and consent disclosure banners in both UI and exported briefs.

### Phase B – Ingestion Fidelity & Provenance (Week 1–3)
1. Ship Akoma Ntoso/ELI/ECLI enrichment pipeline and structural diffing metadata.
2. Productionise Maghreb/Rwanda feeds with failover, quarantine review UI, and provenance dashboards.
3. Wire residency and binding-language analytics into `/metrics/governance` visualisations and alerts.

### Phase C – Operator Console & HITL Experience (Week 2–5)
1. Implement Workspace, Research, Drafting, Matters, Citations, Corpus, Admin, and HITL screens with Appendix A UX primitives.
2. Add mobile navigation, command palette, voice/OCR capture, Outbox/offline flows, and staleness indicators.
3. Hook reviewer actions, audit trails, and SLA metrics to Supabase endpoints to close the HITL loop.

### Phase D – Governance & Launch Operations (Week 4–6)
1. Publish DPIA/CoE/CEPEJ collateral externally and schedule transparency digests.
2. Finalise SLO, incident, change-log dashboards; align them with Go / No-Go evidence requirements.
3. Complete pilot onboarding kit, support runbooks, pricing collateral, and regulator outreach plan ahead of GA.

## Go / No-Go Recommendation
Because critical operator workflows, compliance verifications, and customer-facing collateral remain incomplete, the suite is **not yet production-ready**. Leadership should maintain a NO-GO decision until Phases A–D above are executed and the Go / No-Go checklist can be marked fully satisfied with artefact evidence.

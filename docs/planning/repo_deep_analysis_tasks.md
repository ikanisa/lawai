# Repository Deep Analysis & Task Backlog

This backlog distils the outstanding production gaps highlighted across the Avocat-AI Francophone monorepo into actionable tasks. Each item references the authoritative programme status report and maps to the code paths that require work so squads can pick up implementation confidently.

## Task Backlog

### 1. Ship consent capture UI & device telemetry hardening
- **Why it matters:** The production checklist still calls out missing consent capture flows, admin controls, and full device registry telemetry despite the access middleware landing on the API side.【F:docs/implementation_status_report.md†L46-L47】 Completing this closes the GDPR/COE disclosure gap before launch.
- **Key touchpoints:**
  - Web console policy surfaces (`apps/web/src/components/admin/` and `apps/web/messages/*`).
  - API device session endpoints (`apps/api/src/device-sessions.ts`, `apps/api/src/server.ts`).
  - Supabase consent/device tables (`db/migrations/0026_user_management.sql`, `db/migrations/0059_hitl_resolution_metrics.sql`).
- **Deliverables:** Capture modal + ledger banner, admin override dashboards, device inventory view, telemetry events, and E2E tests.
- [Start task](start-task://consent-ui-telemetry)

### 2. Automate Maghreb/Rwanda feed resiliency & statute alignment
- **Why it matters:** Remaining ingestion scope calls for hardening Maghreb/Rwanda live feeds beyond RSS fallbacks and wiring automated statute alignment into the crawler outputs.【F:docs/implementation_status_report.md†L48-L51】 This ensures francophone coverage parity and accurate citator data.
- **Key touchpoints:**
  - Edge crawler jurisdictions (`apps/edge/crawl-authorities/index.ts`).
  - Case/statute linking schema (`db/migrations/0021_case_quality_schema.sql`).
  - Ops monitors for ingestion health (`apps/ops/src/check.ts`).
- **Deliverables:** Implement resilient fetchers, add statute alignment enrichment, alerting hooks, and regression tests for new jurisdictions.
- [Start task](start-task://ingestion-maghreb-rwanda)

### 3. Close FRIA & CEPEJ automation gaps in the agent pipeline
- **Why it matters:** Planner/executor separation exists, but FRIA gates, CEPEJ compliance checks, and audited trust surface area remain flagged as incomplete in the orchestrator roadmap.【F:docs/implementation_status_report.md†L53-L56】 Strengthening these guardrails is mandatory for EU AI Act readiness.
- **Key touchpoints:**
  - Agent compliance modules (`apps/api/src/agent.ts`, `apps/api/src/compliance.ts`).
  - Learning ticket workflows (`apps/edge/process-learning/index.ts`).
  - Governance artefacts (`docs/governance/`).
- **Deliverables:** Deterministic FRIA checkpoint enforcement, CEPEJ automation, trust panel telemetry, and regression suites.
- [Start task](start-task://agent-fria-cepej)

### 4. Enforce retrieval recall/fidelity thresholds in CI
- **Why it matters:** Retrieval dashboards exist, yet the status report highlights the absence of automated recall/fidelity gates during CI to catch regressions proactively.【F:docs/implementation_status_report.md†L58-L61】 Instituting these thresholds keeps the hybrid retrieval stack trustworthy.
- **Key touchpoints:**
  - Ops evaluation CLI (`apps/ops/src/evaluate.ts`).
  - CI workflow (`.github/workflows/ci.yml`).
  - Retrieval metrics views (`db/migrations/0067_retrieval_metrics_views.sql`).
- **Deliverables:** Threshold configuration, CI assertions, alert outputs, and documentation updates.
- [Start task](start-task://ci-retrieval-thresholds)

### 5. Finish mobile-first PWA polish & CEPEJ "user control" affordances
- **Why it matters:** Appendix A still lists outstanding PWA polish (bottom nav, offline resiliency, Core Web Vitals budgets) and CEPEJ user-control affordances for the console experience.【F:docs/implementation_status_report.md†L63-L66】 Delivering these is required before the VerceI launch.
- **Key touchpoints:**
  - AppShell/navigation components (`apps/web/src/components/app-shell.tsx`, `apps/web/src/components/navigation/`).
  - Offline/outbox hooks (`apps/web/src/hooks/use-outbox.ts`).
  - CEPEJ affordance surfaces (`apps/web/src/components/research/`, `apps/web/src/components/hitl/`).
- **Deliverables:** Mobile navigation, PWA runtime tweaks, offline queue hardening, user-control UI, performance budgets, and Playwright smoke tests.
- [Start task](start-task://pwa-cepej-ux)

### 6. Propagate FRIA/CEPEJ notifications to transparency pages
- **Why it matters:** Governance digests are generated, but the transparency centre still lacks FRIA and CEPEJ publication surfacing per the outstanding operations scope.【F:docs/implementation_status_report.md†L68-L71】 This is essential for regulator readiness and customer trust.
- **Key touchpoints:**
  - Transparency edge functions (`apps/edge/transparency-digest/index.ts`).
  - Governance publications API routes (`apps/api/src/server.ts` around `/governance/publications`).
  - Trust centre UI (`apps/web/src/components/trust/`).
- **Deliverables:** Sync jobs, API extensions, UI cards, localisation strings, and integration tests.
- [Start task](start-task://transparency-fria-cepej)

### 7. Deepen fairness analytics & drill-downs for HITL
- **Why it matters:** The learning workstream still needs richer fairness trends and drill-down analytics for reviewer operations according to the status report.【F:docs/implementation_status_report.md†L73-L76】 Enhancing these insights supports compliance and continuous improvement commitments.
- **Key touchpoints:**
  - Learning reports and metrics (`apps/api/src/server.ts` around `/reports/learning`).
  - HITL dashboards (`apps/web/src/components/hitl/`).
  - Data models (`db/migrations/0011_agent_learning.sql`).
- **Deliverables:** Trend visualisations, bias segmentation, exportable reports, and automated regression checks.
- [Start task](start-task://hitl-fairness-analytics)

### 8. Finalise launch collateral & KPI dashboards
- **Why it matters:** The launch checklist still requires activation of pilot onboarding collateral, customer training, marketing updates, and KPI/alert dashboards prior to go-live.【F:docs/implementation_status_report.md†L105-L110】 Aligning these assets is necessary for a smooth VerceI deployment.
- **Key touchpoints:**
  - Launch collateral docs (`docs/launch/`).
  - Ops reporting CLI (`apps/ops/src/` dashboards).
  - Public web assets (`apps/web/public/governance/`, marketing surfaces in `apps/web/app/[locale]/trust/`).
- **Deliverables:** Collateral refresh, KPI dashboards, automation hooks, and release checklist sign-offs.
- [Start task](start-task://launch-collateral-kpis)

## How to Use This Backlog
1. Review task scope and confirm dependencies with the owning squad.
2. Click the **Start task** button to spin up the implementation issue in your tracking system.
3. Follow the referenced modules/tests when implementing to maintain consistency with the existing architecture.

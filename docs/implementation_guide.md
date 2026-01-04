# Implementation Guide – Avocat-AI Francophone

This guide translates the BELL implementation plan and the accompanying Codex prompts into actionable delivery tracks for the engineering and product teams. It highlights immediate priorities, responsible squads, and references to source materials so that the remaining roadmap can be executed predictably.

## 1. Reference Artifacts
- **Production Roadmap** – `docs/avocat_ai_bell_system_plan.md`, including Appendix A with the full Codex prompt for the SaaS UI/UX.
- **Status Report** – `docs/implementation_status_report.md` for current completion signals and blockers.
- **Backend Codex Prompt** – `prompts/francophone_lawyer_agent_prompt.yaml` for Agents SDK, ingestion, and guardrails.
- **Frontend Codex Prompt** – Appendix A in the system plan ("Build the Francophone Lawyer AI SaaS UI/UX").
- **Schema & Tool Manifest** – `docs/SUPABASE_AND_AGENT_MANIFEST.yaml` enumerating the canonical Supabase tables, RPCs, and Agents SDK tool contracts.
- **Go / No-Go Release Checklist** – `ops/reports/GO_NO_GO_CHECKLIST.md` to be completed before pilot graduation or production releases.

## 2. Workstream Breakdown

### 2.1 Foundation & Environment (Ops Squad)
1. **Secrets & Compliance**: Automate rotation and validation for OpenAI and Supabase keys. Integrate with vault tooling and extend CI checks to verify Supabase extensions and storage policies.
2. **Vector Store Bootstrap**: Ensure `authorities-francophone` exists across environments, add drift detection for document synchronization, and document rollback procedures.
3. **CI/CD Enhancements**: Expand `.github/workflows/ci.yml` to exercise Supabase migrations in preview branches and publish artifacts (schema diffs, seed logs) for audit trails.
4. **Identity Foundations**: Apply the user-management migrations (`org_policies`, `jurisdiction_entitlements`, `audit_events`, `consent_events`, `invitations`, `billing_accounts`) and extend `org_members` roles. Build request middleware that enforces `X-Org-Id`, resolves RBAC × ABAC permissions, and injects policy flags (`confidential_mode`, `fr_judge_analytics_block`, `mfa_required`, `ip_allowlist`). Wire Supabase Auth to issue org-scoped sessions, record consent acknowledgements, and log privileged actions (role changes, policy toggles, exports, residency adjustments) into `audit_events`.

### 2.1.1 Enterprise Identity & Access (Identity Squad)
1. **SSO & SCIM**: Deliver SAML/OIDC configuration UI, group→role mappings, SCIM tokens, and webhook handlers that create/update/deprovision users while populating `org_members`, `profiles`, `consent_events`, and default `jurisdiction_entitlements`.
2. **MFA & Passkeys**: Enforce per-org MFA/passkey requirements from `org_policies` and require step-up re-authentication for HITL approvals, policy changes, role updates, data exports, and residency switches.
3. **Jurisdiction Feature Gates**: Populate `jurisdiction_entitlements` for pilot orgs, surface toggles in the Admin console, and conditionally expose OHADA/EU overlays, Maghreb analytics banners, Rwanda tri-language UI, Confidential Mode, and citizen-tier pathways.
4. **Audit & Consent Surfacing**: Build dashboards/filtering for `audit_events`, expose consent version history, and support export of immutable audit bundles for regulators. Ensure Confidential Mode disables Web Search, mobile caching, and triggers screenshot blurring on supported devices.

### 2.2 Data Ingestion & Provenance (Ingestion Squad)
1. **Jurisdiction Crawlers**: Replace the stubbed edge function with real adapters per domain listed in the plan, including Legilux, Moniteur/Justel, Fedlex/Tribunal fédéral, Justice Laws, Supreme Court of Canada, CanLII, OHADA, and Rwanda Official Gazette/Amategeko/RwandaLII portals. Implement ETag/Last-Modified caching, hash comparisons, and retry queues.
2. **Scheduling**: Configure Supabase Cron for daily/weekly polling aligned with the cadence defined in Appendix A, and publish run telemetry so ingestion freshness is auditable.
3. **Provenance Ledger**: Persist capture metadata (binding language, consolidation status, SHA-256 hashes, content hashes), map authoritative records to ELI/ECLI identifiers, and store Akoma Ntoso JSON payloads for article-level anchors.
4. **Case-Law Trust Metadata**: Populate `trust_tier`, `court_rank`, `court_identifier`, and `source_origin` on `sources`; build `case_treatments` via citator ingestion (including CCJA and CJEU feeds), maintain `risk_register` overlays (political-risk periods/courts), and ensure client uploads remain isolated from public-law caches.
5. **Residency & Security**: Partition Supabase buckets and vector stores by residency envelope (EU/EEA, OHADA, Switzerland, Canada, Rwanda) with encrypted-at-rest policies and C2PA signing for generated briefs.

### 2.3 Agents SDK Orchestrator (Intelligence Squad)
1. **Hosted Tools Integration**: Migrate from the Responses API to the Agents SDK, attach OpenAI Web Search and File Search tools, and implement the function tools enumerated in both Codex prompts (`routeJurisdiction`, `lookupCodeArticle`, `deadlineCalculator`, `ohadaUniformAct`, `limitationCheck`, `interestCalculator`, `generatePleadingTemplate`). Add `validateCitation`, `checkBindingLanguage`, and `snapshotAuthority` to enforce provenance.
2. **Guardrails & HITL**: Enforce allowlist retries, structured output validation, automatic HITL escalation, CEPEJ principle checks, EU AI Act FRIA gating, and persistence of tool invocation logs plus `tool_telemetry` metrics to Supabase. Implement the France-only analytics prohibition and policy banners for judge profiling.
3. **Hybrid Retrieval**: Populate `document_chunks`, expose `/api/search-local`, blend RPC matches with File Search hits for analytics and fallbacks, and apply trust-tier weighting (T1–T4) plus case-score penalties before injecting hybrid snippets. Respect OHADA pre-emption banners and bilingual outputs for Canada and Rwanda.
4. **Case Alignment & Scoring**: Ship the `evaluate_case_alignment` tool backed by `case_statute_links`, compute multi-axis case-quality scores (Doctrinal Fit, Precedential Posture, Subsequent Treatment, Procedural Integrity, Jurisdictional Fit, Language Binding, Recency, Citation Quality) via `case_scores`, honour overrides, and trigger HITL when scores fall below thresholds or hard blocks occur.
5. **Planner/Executor/Verifier Split**: Implement deterministic run keys, per-tool budgets, optimistic execution with guardrail tripwires, and memory trimming/compression for long-running matters.

### 2.4 Front-End & HITL Console (Experience Squad)
1. **App Shell & Infrastructure**: Scaffold a Next.js App Router project with Tailwind CSS, shadcn/ui, TanStack Query, Zustand/Context, and PWA support. Implement global theming tokens (gradients, glass surfaces) and bilingual i18n plumbing.
2. **Cross-Cutting Components**: Build the component set prescribed in Appendix A (JurisdictionChip, PlanDrawer, IRACAccordion, CitationCard, VersionTimeline, RiskBanner, LanguageBanner, RedlineDiff, DeadlineWizard, HITLQueueTable, AuthorityViewer, SourceBadge, EmptyState, ErrorState) with WCAG 2.2 AA compliance.
3. **Screen Implementation**: Deliver the eight primary screens (Workspace, Research, Drafting, Matters, Citations Browser, HITL Review, Corpus & Sources, Admin) honoring the UX rules, feature flags, and telemetry instrumentation. Include analytics compliance banners (e.g., “Analytics disabled in France”), OHADA pre-emption notices, bilingual toggles (FR/EN, FR/EN/Kinyarwanda for Rwanda), authority ribbons, case score explainers, and C2PA export indicators.
4. **QA & Accessibility**: Execute the QA checklist verbatim—keyboard navigation, localization toggles, dark mode, mobile layouts, error states, and performance budgets—and add CEPEJ ethical charter spot checks plus user-control affordances (“Request human review”, “Reveal sources”, “Export C2PA Brief”).

#### 2.4.1 Mobile PWA Readiness Addendum (Experience Squad)
1. **Mobile Information Design**: Implement the three reading modes (Research, Brief, Evidence) with quick toggles, article-level anchors that highlight citations when tapped, progressive disclosure for TL;DR summaries, and portrait-first compare views that collapse into single-column diff summaries before offering side-by-side layouts in landscape.
2. **Navigation & Ergonomics**: Ship the bottom navigation bar (Home, Research, Drafting, Queue) with a centred FAB (“Ask”), command palette accessible via `/` or long-press, and deep-linkable URLs for IRAC answers, version diffs, and citation viewers. Add voice dictation, camera OCR ingestion, and Android/iOS share targets that route evidence into the inbox.
3. **Accessibility & Trust**: Enforce WCAG 2.2 AA+ mobile specifics—16–20px base typography with 1.6–1.7 line heights, ≥44px tap targets, sticky HITL CTA, ARIA landmarks/headings, text-to-speech buttons, and high-contrast gradients. Surface authority ribbons, staleness chips with “Verify now”, case score badges, Maghreb binding-language banners, and Canada bilingual toggles directly in answers.
4. **PWA & Performance**: Configure manifest icons/splash screens, shortcuts (New Research, Draft, Review), polite install prompts, and Workbox strategies (Stale-While-Revalidate for shell, Network-First for official law, no-store for private uploads unless encrypted cache enabled). Track Core Web Vitals (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1) on mid-range Android devices and expose dashboards in telemetry.
5. **Privacy-by-Design**: Enhance Confidential Mode to disable Web Search, blur app previews, block screenshots where supported, and skip local caching. Provide optional encrypted per-org caches with expiry notices for field work and ensure offline autosaves respect encryption rules.
6. **Offline & Notifications**: Queue failed prompts/uploads in an Outbox with retry controls, show stale answers with “verify now” prompts when offline, and support opt-in push/weekly digest notifications plus Outbox state in the UI.
7. **Exports & Printing**: Produce pixel-perfect PDF/DOCX exports (A4 & Letter) with bibliographies and C2PA signatures, ensure print styles respect mobile compare/reading modes, and expose share sheets that preserve research context via query params.
8. **Quick-Win Sprint Backlog**: Prioritise staleness chips, Outbox with retries, FAB voice input + camera OCR flows, Confidential Mode UI improvements (blur + no cache), and 44px tap-target + sticky HITL CTA updates to unblock usability testing.

### 2.5 Governance & Launch (Compliance Squad)
1. **Policy Authoring**: Draft responsible-AI guidelines, conflict-of-interest processes, data retention, incident response, CEPEJ charter mapping, EU AI Act FRIA templates, Council of Europe AI convention commitments, France judge-analytics prohibition, Rwanda privacy law compliance, and Malabo Convention guidance.
2. **Operational Readiness**: Prepare pilot onboarding guides, SLO documentation, change-management workflows, FRIA/AI risk files, transparency report templates, the Go / No-Go Release Checklist execution playbook, and commercial collateral (pricing decks, ROI summaries).
3. **Observability**: Instrument dashboards for the telemetry events outlined in Appendix A and ensure alerting for ingestion failures, guardrail breaches, HITL SLA violations, data residency exceptions, and fairness drift signals.

### 2.6 Agent Learning & Continuous Improvement (Intelligence + Ops Squads)
1. **Data Model Extension**: Implement migrations for `agent_learning_jobs`, `agent_synonyms`, `agent_policy_versions`, `tool_telemetry`, and `agent_task_queue`, wiring RLS and Supabase clients to surface these tables in analytics.
2. **Learning Loop Automation**: Capture retrieval sets, IRAC payloads, risk ratings, tool telemetry, and reviewer outcomes for every run; build hourly processors that convert diagnostics into learning tickets (indexing, synonym, guardrail tuning) and daily evaluators that execute golden sets (citation precision, temporal validity, binding-language banners, HITL recall).
3. **Policy Governance**: Version allowlist hints, synonym updates, and prompt adjustments via `agent_policy_versions`, exposing change logs in admin dashboards and ensuring confidential client data is excluded unless an org explicitly opts in.
4. **Case Quality Feedback**: Persist `case_scores` histories, downstream reviewer overrides, FR case-analytics redactions, and drift alerts when precedent treatment changes; retrain retrieval weights and deny/boost lists based on negative treatments, political-risk flags, low composite scores, or bilingual discrepancies.
5. **Benchmarking**: Integrate LegalBench and LexGLUE suites into CI and nightly jobs, publishing deltas per jurisdiction and feeding anomalies into governance reviews.

### 2.7 Agent Task Execution & Tooling (Intelligence Squad)
1. **Planner/Executor/Verifier Pipeline**: Refactor the Agents SDK integration to make explicit plan → act → verify → log stages, including deterministic run keys, per-tool budgets, retries/backoff, and automatic HITL escalation for hard triggers (penal/contentieux filings, sanctions risk, Maghreb language uncertainty, missing official sources).
2. **Tool Registry & Telemetry**: Populate `agent_tools` with metadata for retrieval, calculator, drafting, governance, and corpus tools; emit `tool_telemetry` entries for latency and error codes; enforce Confidential Mode behaviour (Web Search disabled, File Search only).
3. **Task Queue Operations**: Use `agent_task_queue` to orchestrate research answers, drafting, clause redlines, deadline calculations, cite-checks, authority snapshots, corpus admin actions, and FRIA review tasks. Surface queue states, residency alerts, and learning status indicators in the Admin → Analytics UI once the front-end ships. Feed case-quality summaries into the analytics layer (“Why you can trust this”) alongside reviewer overrides.
4. **Compliance Gateways**: Implement automated checkpoints that block disallowed behaviour (judge profiling in France, analytics on magistrates, missing FRIA) and require human acknowledgement before progressing high-risk workflows.

## 3. Sequencing & Milestones

| Milestone | Target Window | Primary Deliverables |
| --- | --- | --- |
| **M0 – Core Foundations** | Weeks 0–4 | Agents SDK migration, hybrid retrieval prototype, initial Next.js shell (Workspace + Research skeleton), ingestion adapters for France/OHADA/EUR-Lex. |
| **M1 – Jurisdiction Expansion** | Weeks 5–8 | Maghreb connectors with language banners, Switzerland & Québec data sources, Deadline/Interest calculators, Workspace telemetry instrumentation. |
| **M2 – HITL & Governance** | Weeks 9–12 | Full HITL review experience, evaluations harness, governance policy pack, Admin & Corpus screens. |
| **M3 – Launch Prep** | Weeks 13–16 | Performance hardening, dark-mode QA, marketing collateral, pilot onboarding completion, readiness checklist sign-off. |

## 4. Execution Checklist (Per Sprint)
- Reconcile progress with `docs/implementation_status_report.md` and update statuses at sprint close.
- Validate new features against the Codex prompt acceptance criteria (authority-first evidence, Maghreb language banner, HITL flows, WCAG). Document variances with remediation owners.
- Run automated tests (`pnpm test`), linting, and Supabase migration checks before merging.
- Capture demo artifacts (screenshots, videos) for stakeholder reviews, especially for new front-end components.

## 5. Handoff Expectations
- Maintain additive changes: avoid regressions in existing agents/ingestion APIs while building the UI.
- Keep localized strings in the centralized messages catalog; default to French and ensure English translations ship concurrently.
- Log all telemetry events and review dashboards weekly to ensure instrumentation accuracy.

Following this guide keeps the backend, ingestion, agent orchestration, and UI tracks aligned with the Codex prompts and the production roadmap, enabling the team to ship the autonomous francophone lawyer experience to list-priced readiness.

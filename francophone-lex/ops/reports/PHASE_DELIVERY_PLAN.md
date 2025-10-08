# Four-Phase Delivery Plan

The Avocat-AI Francophone programme ships in four sequenced phases. Each phase is scoped so squads can copy/paste these tasks into execution trackers without further elaboration.

## Phase 1 – Foundation & Environment Hardening (Weeks 0–4)
- **Supabase Environment Automation**
  - Script extension verification for `pgvector`, `pg_trgm`, and `pg_cron`; fail CI if not enabled.
  - Provision storage buckets (`authorities`, `uploads`, `snapshots`) with per-org prefixes and signed URL policies.
  - Add CI/CD jobs to apply SQL migrations, seed jurisdictions/domains, and bootstrap default org/policy rows.
- **Secrets & Configuration Management**
  - Validate `OPENAI_API_KEY`, `OPENAI_VECTOR_STORE_AUTHORITIES_ID`, and Supabase keys at boot; surface actionable errors.
  - Document rotation SOP for OpenAI and Supabase service role keys; automate detection of stale credentials.
- **Vector Store Bootstrap**
  - Create the `authorities-francophone` OpenAI Vector Store in provisioning scripts.
  - Upload seed OHADA/France/Belgium/Luxembourg documents; poll ingestion status and mirror file metadata into Supabase.
- **RBAC × ABAC Enforcement**
  - Implement middleware that reads `org_policies`, `jurisdiction_entitlements`, and Confidential Mode flags; block disallowed tool calls.
  - Enforce France judge-analytics ban and Confidential Mode in `/runs` flow and tool payloads.
- **Ingestion Adapter Finalisation**
  - Build live collectors for Legilux, Moniteur/Justel, Fedlex/Tribunal fédéral, LégisQuébec/CanLII, Morocco SGG, Tunisia JORT, Algeria JORADP, and Rwanda portals.
  - Capture ELI/ECLI identifiers, adoption/effective dates, binding-language tags, and SHA-256 hashes.
  - Schedule cron triggers (daily/weekly) with ETag/hash diffing to avoid duplicate uploads.
- **Learning Loop Activation**
  - Finish hourly processors that consume `agent_learning_jobs` for indexing and query-rewrite tickets.
  - Generate nightly drift reports summarising citation precision, temporal validity, and binding-language warnings; push metrics to telemetry tables.

## Phase 2 – Agent Compliance & Retrieval Excellence (Weeks 5–8)
- **Compliance Gate Integration**
  - Embed EU AI Act FRIA checkpoints, CEPEJ principle tests, and Council of Europe AI treaty assertions into the `/runs` pipeline.
  - Persist FRIA artefacts, reviewer decisions, and residency checks alongside each agent run.
- **Planner / Executor / Verifier Split**
  - Separate the agent into deterministic planning, execution, and verification steps with per-tool budget enforcement and retry logic.
  - Ensure planner logs tool selection rationale without exposing chain-of-thought in final outputs.
- **Trust & Scoring Enhancements**
  - Backfill `case_treatments`, `case_statute_links`, and `risk_register` from citator feeds; refresh case reliability scoring nightly.
  - Surface “Why you can trust this” panels using live treatments, risk flags, and reviewer overrides.
- **Evaluation & Telemetry Expansion**
  - Add LegalBench and LexGLUE harnesses; log jurisdiction-specific pass/fail metrics to Supabase dashboards.
  - Implement link-health monitors, citation precision charts, fairness drift alerts, and Maghreb banner coverage tracking.
- **Guardrail Reinforcement**
  - Extend guardrails for cite-or-refuse, binding-language enforcement, and sensitive-topic HITL triggers with alerting when violated.

## Phase 3 – Experience, Identity, and Operator Console (Weeks 9–12)
- **Next.js App Router Console**
  - Deliver Workspace, Research (3-pane/stacked), Drafting, Matters, Citations, HITL Review, Corpus & Sources, and Admin screens using shadcn/ui components.
  - Implement liquid-glass theming, bilingual localisation (FR default, EN toggle), and WCAG 2.2 AA accessibility (skip links, focus management, ARIA landmarks).
- **Mobile-First PWA Enhancements**
  - Add safe-area-aware navigation, bottom FAB, voice dictation, camera OCR capture, offline outbox, staleness chips, and Workbox service worker strategies.
  - Implement Confidential Mode UI (blur previews, disable Web Search controls, banner copy) and enforce no local caching of private docs.
- **Document & Drafting Tools**
  - Integrate Supabase-backed pleading templates, clause library comparisons, redline diffing with accept/reject controls, and export to PDF/DOCX with C2PA signatures.
- **Identity & Security Features**
  - Ship SSO/OIDC configuration UI, SCIM token management, MFA/passkey enrolment, IP allowlists, device/session controls, consent logs, and audit dashboards.
  - Ensure role gating across all pages with optimistic yet secure TanStack Query patterns.

## Phase 4 – Governance, Launch Ops, and Performance (Weeks 13–16)
- **Governance Documentation & Evidence**
  - Publish CEPEJ charter mapping, EU AI Act FRIA logs, Council of Europe AI framework alignment, GDPR/Rwanda/Malabo residency matrices, DPIA templates, and responsible-AI collateral.
  - Generate transparency, incident response, and compliance reports ready for client/regulator review.
- **Operational Readiness**
  - Finalise pilot onboarding playbook, change-management workflows, pricing collateral, ROI calculators, and marketing one-pagers.
  - Define SLO dashboards for latency, HITL turnaround, ingestion freshness, and evaluation coverage; wire alerts to Ops channels.
- **Performance & Resilience**
  - Execute load tests on API and UI, validate Core Web Vitals, benchmark agent latency, and optimise budgets/timeouts.
  - Run red-team scenarios (unauthorised scraping, non-allowlisted sources, language ambiguities) and capture mitigations.
- **Launch Gate Execution**
  - Walk through the Go/No-Go checklist with evidence artefacts per control area.
  - Prepare post-launch monitoring cadence (monthly evals, policy/version changelog, customer feedback loop) and schedule first transparency update.

Copying this file into team workspaces provides the phase-by-phase execution tasks without re-reading the full implementation plan.

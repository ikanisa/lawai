# Avocat-AI Francophone — BELL Analysis & Production Implementation Plan

## 1. BELL Framework Deep Analysis

### 1.1 Business (B)
- **Value Proposition**: Provide a production-grade, autonomous francophone legal agent delivering IRAC-structured, citation-backed guidance across France, Québec/Canada, Belgium, Luxembourg, Switzerland (FR cantons), Monaco, the Maghreb, and all 17 OHADA member states.
- **Customer Segments**:
  - International law firms and in-house legal departments operating across francophone jurisdictions.
  - Corporate compliance and risk teams needing rapid regulatory intelligence.
  - Government agencies and development banks supporting OHADA integration.
- **Revenue Model & List Pricing**:
  - Tiered SaaS pricing anchored on annual commitments with per-seat overages; indicative list price = **€2,450/user/year** for core legal teams (includes 1,500 monthly agent calls, Supabase tenancy, HITL dashboard, and priority support).
  - Enterprise bundle (100+ seats) at €220,000/year including dedicated vector store, private web-search allowlists, and quarterly governance reviews.
  - Professional services add-ons: migration of legacy knowledge bases, jurisdictional updates, and tailored function tools billed at €1,600/day.
- **Competitive Differentiators**:
  - Native OHADA-first logic with CCJA jurisprudence prioritization.
  - End-to-end provenance logging and binding-language awareness for Maghreb jurisdictions.
  - Integrated HITL queue and structured outputs suitable for regulatory audits.
- **KPIs**: citation precision ≥ 95%, HITL recall ≥ 98%, latency < 20s P95, ARR growth, customer retention, compliance incidents (target 0).

### 1.2 Engineering (E)
- **Architecture**: OpenAI Agents SDK orchestrator with web search, file search, and Supabase-backed function tools; hybrid retrieval (OpenAI Vector Store + pgvector mirror).
- **Scalability**: Horizontal scaling of agent API via containerized deployment (Kubernetes or serverless), Supabase connection pooling, caching of jurisdictional metadata.
- **Reliability**: Structured output validation, guardrails for citation allowlists, replayable tool invocation logs, blue/green deployment for prompt & tool updates.
- **Security**: RLS-enforced multi-tenancy, encrypted storage, SOC 2 controls, least-privilege access for crawlers and operators.
- **Maintainability**: Monorepo with shared packages for schemas/constants, automated cron-driven ingestion of authoritative sources, observability dashboards.

### 1.3 Legal & Compliance (L)
- **Professional Responsibility**: Cite-or-refuse policy, mandatory disclaimers, automatic HITL escalation for high-risk outputs, audit-ready logging aligned with TOJI/State Bar of Texas guidance.
- **Data Governance**: Separation of public authority cache vs. client uploads, Supabase Storage with per-org buckets, data residency mapping (EU vs. Africa vs. Canada), GDPR and LGPD readiness.
- **Licensing & IP**: Document jurisdiction-specific reuse rights, track government API licensing (e.g., Legifrance terms), ensure compliance with OHADA publication policies.
- **Regulatory Alignment**: Provide transparency reports, maintain conflicts-of-interest registry, ensure unauthorized practice of law guardrails when operating in regulated jurisdictions.

### 1.4 Launch & Lifecycle (L)
- **Go-to-Market**: Soft launch with 3 pilot firms (France, Côte d'Ivoire, Canada), gather red-team feedback, expand to full commercial release after evaluation benchmarks achieved.
- **Lifecycle Management**: Versioned prompt templates, monthly corpus refresh, quarterly model evaluation, governance board oversight, and customer success reviews.
- **Support & Training**: Onboarding sessions, knowledge base, incident escalation runbooks, 24/5 support coverage.

## 2. End-to-End System Implementation Plan

### 2.1 High-Level Architecture
1. **Agents Layer**: OpenAI Agents SDK orchestrator (`avocat-francophone`) using `gpt-5-pro` (fallback `gpt-4o`) with:
   - Web Search tool restricted to the official allowlist (France, Belgium, Luxembourg, Switzerland, Monaco, Canada/Québec, Maghreb, OHADA, EUR-Lex, OAPI, CIMA).
   - File Search tool attached to `OPENAI_VECTOR_STORE_AUTHORITIES_ID` containing curated PDFs/HTML snapshots of statutes, codes, gazettes, and high-court decisions.
   - Function tools: `routeJurisdiction`, `lookupCodeArticle`, `deadlineCalculator`, `limitationCheck`, `interestCalculator`, `ohadaUniformAct`, `generatePleadingTemplate`.
   - Structured Outputs enforcing IRAC schema with risk levels, warnings, and HITL triggers.
2. **Data Layer**: Supabase Postgres with pgvector mirror, RLS, storage buckets (`authorities`, `uploads`, `snapshots`), scheduled edge functions for source ingestion.
3. **Ingestion & Crawling**: Supabase Edge Functions + cron to poll Legifrance, Justel, Legilux, LegiMonaco, Fedlex, LégisQuébec, OHADA, CCJA, SGG Morocco, IORT Tunisia, JORADP Algeria, EUR-Lex, OAPI, CIMA. Documents stored, hashed, and uploaded to OpenAI Vector Store.
4. **Application Layer**: API service (Node 20 / Fastify or Next.js) exposing endpoints for agent runs, document uploads, HITL workflow, local search; Operator console for legal teams.
5. **Observability**: Metrics via Supabase logs + external telemetry (Prometheus/Grafana). Alerts for guardrail violations, RLS errors, ingestion failures.
6. **Security & Compliance**: SSO integration (SAML/OIDC), audit logs, encryption, DPA templates, TOJI/State Bar-aligned governance policies.

### 2.2 Detailed Workstreams & Deliverables

#### A. Foundation & Environment
- Configure Supabase project (extensions: `pgvector`, `pg_trgm`, optionally `pg_cron`).
- Apply SQL migrations for organizations, memberships, sources, documents, chunks, agent runs, tool logs, HITL queue, evaluation harness, RLS policies, RPC (`match_chunks`, `domain_in_allowlist`).
- Initialize storage buckets with per-org prefixing and signed URL policies.
- Create OpenAI vector store `authorities-francophone`; set environment variables (`OPENAI_API_KEY`, `OPENAI_VECTOR_STORE_AUTHORITIES_ID`, `SUPABASE_*`, `AGENT_MODEL`, `EMBEDDING_MODEL`, `JURIS_ALLOWLIST_JSON`).
- Provision CI/CD pipelines (GitHub Actions) for linting, tests, migrations, deployment.

#### A1. Identity, Access, and Tenant Governance
- **Objectives**: Guarantee tenant isolation (no data bleed), combine role-based (RBAC) and attribute-based (ABAC) controls, support enterprise identity (SSO, SCIM, MFA/passkeys, IP allow-lists), enforce legal-sector policies (HITL reviewer chains, France judge-analytics ban, consent tracking), and maintain immutable audit trails.
- **Data Model**: Extend `org_members` roles to `owner`, `admin`, `member`, `reviewer`, `viewer`, `compliance_officer`, `auditor`; augment `profiles` with professional metadata (`professional_type`, `bar_number`, `court_id`, `verified`). Introduce:
  - `org_policies` (per-org policy flags such as `confidential_mode`, `fr_judge_analytics_block`, `mfa_required`, `ip_allowlist`).
  - `jurisdiction_entitlements` (per-org capability matrix for FR/BE/LU/CH-FR/CA-QC/OHADA/RW/MA/TN/DZ, OHADA/EU overlays, Rwanda tri-language UI).
  - `audit_events` (append-only immutable ledger for privileged actions, reviewer decisions, exports, residency changes).
  - `consent_events` (ToS/Privacy/AI-assist acknowledgements with versioning per org/user).
  - `invitations` (tokenised invites with role, expiry, acceptance metadata) and `billing_accounts` (plan, seat allocations, metering references).
- **RBAC × ABAC Enforcement**: Implement request middleware that reads `X-Org-Id`, loads `org_policies` + `jurisdiction_entitlements`, and evaluates permission matrices (e.g., `research.run`, `hitl.review`, `policies.manage`, `audit.read`, `data.export_delete`). Enforce Confidential Mode (disable Web Search, disable local caching, require blur on mobile), France-mode (judge analytics off), and HITL gate rules server-side and in tools.
- **Identity Providers**: Ship SAML/OIDC SSO with group→role mapping, SCIM provisioning (create/update/deprovision, org assignment), optional domain capture for JIT onboarding, and MFA/passkey policies per org (required for admin and HITL actions). Support IP allow-lists/geo fences for privileged endpoints and maintain a device/session registry with “sign out all devices”.
- **Lifecycle & Auditing**: Deliver flows for org creation, invitation acceptance, SCIM sync, role changes (MFA re-auth, audit log, email notification), deprovisioning, data export/deletion (C2PA-signed artefacts respecting retention), and emergency break-glass access (dual approval, auto-expiry, full logging).
- **Admin Console Requirements**: Provide UI to manage people & roles, policies (Confidential Mode, France-mode, MFA/IP allow-list), jurisdiction entitlements, SSO/SCIM credentials, billing, audit trails, consent versions, and residency zones. Surface consent status per user and outstanding reviewer verifications.

#### B. Data Ingestion & Provenance
- Implement Supabase Edge Function `crawl-authorities` with domain-specific adapters:
  - OHADA Uniform Acts & CCJA decisions (Abidjan portal, PDF downloads, versioning).
  - EU/EUR-Lex (ELI/CELEX handling) for FR/BE/LU overlays.
  - Maghreb gazettes with language status metadata and translation flags.
  - Switzerland Fedlex + Tribunal fédéral; Canada/Québec LégisQuébec, Justice Laws, Supreme Court of Canada, and CanLII snapshots; Rwanda Official Gazette portals (MINIJUST, RLRC, Amategeko) and Judiciary reports.
- Normalize metadata (title, jurisdiction, source type, adoption/effective dates, binding language, consolidation status, canonical URL, SHA-256 hash) and persist ELI/ECLI identifiers whenever available so subsequent citator lookups remain deterministic.
- Store canonical texts in Akoma Ntoso-aligned JSON structures to preserve article hierarchy, footnotes, and cross references for downstream explainability.
- Upload documents to Supabase Storage and the OpenAI Vector Store; mirror embeddings into pgvector with provenance hashes and classification into trust tiers.
- Schedule daily/weekly polling using Supabase Cron; maintain change detection via ETag/hash diff, content hashing, and link-health monitoring dashboards.

#### B1. Defense-in-Depth for Jurisprudence
- **Trust-tiered corpus**: classify every ingested authority as T1 (statutes/regulations/gazettes), T2 (high courts/CCJA/CJEU), T3 (appellate & specialised tribunals), or T4 (trial courts/commentary). Persist provenance hashes, versioning, binding-language notes, and enforce segregation between public law caches and client uploads.
- **Citator & risk metadata**: maintain `case_treatments` to capture overruled/criticised/followed links with weights and decay; deprecate low-confidence cases automatically. Add `risk_register` overlays for political-risk periods/courts and require reviewer approval before such items influence drafting.
- **Retrieval weighting**: favour statutes first, boost T1/T2, down-weight T3/T4 using configurable weights (`T1=1.00`, `T2=0.85`, `T3=0.45`, `T4=0.20`). Apply penalties for negative treatment (-0.50), pending appeals (-0.30), and political-risk flags (-0.40); hard-block overruled/vacated decisions and enforce statute anchors plus multi-source corroboration for novel issues.
- **Answer guardrails**: extend IRAC outputs with trust summaries, surface binding language warnings, expose counter-views, and trigger HITL whenever only low-trust sources remain or sensitive topics (election law, sanctions, protest/assembly, national security) rely on contested jurisprudence.
- **Monitoring & learning**: expand golden sets with contested cases, log citation precision, temporal validity, negative-treatment avoidance, and HITL recall. Feed reviewer downgrades into deny/boost tables, regenerate embeddings metadata, and emit drift alerts when precedent treatment changes.
- **Minimal configuration**: codify retrieval weights, penalties, and gates directly in Supabase configuration tables so ops can adjust without redeploying code; ship dashboards that visualise trust tiers, blocked cases, and reviewer interventions.

#### B2. Case Reliability & Fairness Scoring
- **Purpose**: convey the evidentiary strength of each cited case, highlight political or procedural risks, and comply with CEPEJ, EU AI Act, and Council of Europe fairness principles.
- **Axes (0–100 composite)**: Doctrinal Fit (alignment with controlling statute/Uniform Act/constitution using ELI/ECLI crosswalks), Precedential Posture (apex vs. intermediate vs. trial, publication status, ratio/obiter), Subsequent Treatment (citator graph weights with decay), Procedural Integrity (access to counsel, public reasoning, appeal posture—advisory cap), Jurisdictional Fit (binding vs. persuasive for the user matter), Language Binding (penalise non-binding translations and OCR uncertainty), Recency (age-adjusted per practice area), Citation Quality (depth/quality of statutory/high-court references).
- **Safeguards**: hard-block overruled/vacated, penalise pending appeals and political-risk flags, and never expose judge analytics; enforce France-specific redactions to comply with the ban on magistrate profiling.
- **Explainability & Overrides**: surface “Why this score” panels with rationale strings, allow reviewers to override via `case_score_overrides`, and store HITL feedback as training signals.
- **Human-in-the-loop**: automatically pause outputs and queue reviewers when low scores intersect with high-risk matter types (litigation filings, sanctions, penal, liberty impacts) or when CEPEJ “user control” thresholds demand escalation.

#### C. Agent Orchestration & Tools
- Build shared package with IRAC schema, allowlist constants, jurisdiction metadata.
- Implement function tools:
  - `routeJurisdiction`: heuristics + Supabase metadata to detect OHADA/EU overlays; fall back to human confirmation when ambiguity > threshold.
  - `lookupCodeArticle`: query Supabase `sources` to resolve canonical article URLs (ELI/CELEX) with binding status.
  - `deadlineCalculator` & `limitationCheck`: YAML rule engine per jurisdiction; return computed deadlines and risk notes.
  - `interestCalculator`: integrate statutory interest tables (France, OHADA, Québec, etc.).
  - `ohadaUniformAct`: map topics to Uniform Acts (AUSCGIE, AUS, AUDCG, AUDCIF, AUPCAP, etc.) including adoption/effective dates.
  - `evaluateCaseAlignment`: surface statute alignment evidence for case law using `case_statute_links` and enforce minimum alignment thresholds.
- Define output guardrails ensuring citations fall within allowlist; if not, auto-retry with site filters and escalate to HITL on failure.
- Persist agent runs, tool invocations, citations, risk, warnings, and HITL status to Supabase.
- Compute case-quality scores (0–100) along eight axes (precedential weight, subsequent treatment, statute alignment, procedural integrity, jurisdiction fit, language binding, recency, citation quality). Store results in `case_scores`, block overruled/vacated decisions, apply reviewer overrides, and expose “Why you can trust this” panels in UI plus automatic HITL escalations for low scores.

#### C1. Compliance Guardrails & Judicial-Analytics Restrictions
- Embed CEPEJ’s five ethical principles (fundamental rights, non-discrimination, quality/security, transparency/fairness, under user control) as acceptance criteria and automated tests for every tool or UI change.
- Classify judicial-support use cases as “high-risk” under the EU AI Act; require Fundamental Rights Impact Assessments (FRIA), explicit HITL checkpoints, and auditable decision logs before releasing adjudication-influencing functionality.
- Enforce a France-only “Analytics OFF” mode that blocks judge profiling, strips magistrate identifiers from datasets, and surfaces policy banners whenever analytics features are unavailable for compliance.
- Reference the Council of Europe Framework Convention on AI and embed its transparency, oversight, accountability, and equality clauses into DPA templates, policy docs, and admin UI disclosures.

#### D. Retrieval & Evaluation
- Implement hybrid retrieval API combining OpenAI File Search and local `match_chunks` RPC for analytics/fallback.
- Seed evaluation prompts per jurisdiction; create CLI to execute evaluations and log results.
- Configure automatic regression tests (Vitest) for guardrails, RLS policies, RPC accuracy, function-tool outputs.
- Track key metrics (citation precision, temporal validity, binding-language warnings, HITL triggers).

#### E. Front-End & HITL Workflows
- Implement a production-grade, mobile-first SaaS UI using **Next.js App Router**, **React**, **TypeScript**, **Tailwind CSS**, and **shadcn/ui**, respecting the liquid-glass visual system (blurred translucent cards, vibrant gradients, rounded-2xl, generous spacing) and global OpenAI Agents SDK-first constraints.
- Adopt **TanStack Query** for server data fetching, localized UI state via **Zustand/Context**, and centralize i18n strings (French default, English optional) with a persistent language toggle. Guarantee WCAG 2.2 AA accessibility, keyboard navigation, skip links, focus rings, and high contrast in light/dark themes.
- Build an **App Shell** with top bar (logo, command bar, notifications, org switcher, profile), collapsible left navigation (Workspace, Research, Drafting, Matters, Citations, HITL Review, Corpus & Sources, Admin), and mobile FAB (New Research, Upload, New Draft). Ensure responsive layouts: three-pane desktop patterns collapsing into single-column mobile with bottom sheets.
- Ship cross-cutting components: Jurisdiction chips with OHADA/EU flags, Plan Drawer (agent steps/tools/provenance—no chain-of-thought), IRAC accordion (Issue→Rules→Application→Conclusion with copy/export), Citation cards (badges: Officiel, Consolidé, Traduction, Jurisprudence), Risk banner (LOW/MED/HIGH + HITL CTA), Language banner for Maghreb binding-language caveats, Version timeline (original vs consolidated), Redline diff viewer, Deadline wizard, HITL queue table, Authority viewer, Source badges, Empty/Error states.
- Screen requirements:
  - **Workspace**: Hero ask bar (“Posez votre question juridique…”), jurisdiction chips, recent matters, compliance watch feed, HITL inbox. Works on desktop/mobile with FR strings and screen-reader labels.
  - **Research**: Desktop three-pane (Query/Tools, IRAC answer, Evidence). Query pane exposes jurisdiction router dropdown (Auto, FR, BE, LU, CH, CA-QC, OHADA, Maghreb), OHADA/EU toggles, Confidential/File Search-only mode, date/version filters. Answer pane shows IRAC accordion, risk banner, opposing view toggle, one-click HITL. Evidence pane lists citations with badges, citation viewer, version timeline. Handle “cannot verify official source” state with HITL suggestion.
  - **Drafting**: Template gallery (assignations, mises en demeure, contrats, PV, protocoles), Smart Draft workspace (prompt/upload start), clause library with benchmark panel, live redline comparison (per-change accept/reject, explain modal with legal basis and citations), export DOCX/PDF.
  - **Matters**: Overview (parties, venues, governing law, risk, status), computed timeline from deadline wizard (court vs calendar days, timezone, method tooltip), documents tree with search and compare, cite-check indicator, ICS exportable calendar.
  - **Citations (Authority Browser)**: Search official sources, filters (jurisdiction, type, date), 3-pane viewer (TOC anchors, document canvas, metadata with binding/consolidation), version diff view, dedicated OHADA tab prioritizing Uniform Acts + CCJA digest.
  - **HITL Review**: Queue table with filters (risk, translation caveat, litigation). Review screen surfaces IRAC output, sources, delta vs latest law, reviewer actions (approve, request changes, reject) in ≤2 clicks, comment box, audit log.
  - **Corpus & Sources**: Allowlist manager (toggle domains per jurisdiction, role-gated), ingestion snapshots (checksums, timestamps), File Search corpora upload/status views.
  - **Admin**: Organization & roles (invite/manage owner/admin/member/reviewer), billing placeholders (seat usage, metered runs, invoices), security settings (SSO/SAML placeholders, IP allowlist, DLP), policy controls (cite-or-refuse strictness, HITL thresholds, retention settings).
- Global UX rules: surface jurisdiction chips and OHADA/EU flags on every research prompt, maintain agent transparency via plan drawer, display Maghreb binding-language banner when applicable, ensure authority-first evidence with badges, and provide prominent “Soumettre à revue” flows with reviewer queue and audit trail.
- PWA support: installable shell, offline cache for static assets (not legal content), 150–200ms micro-animations respecting `prefers-reduced-motion`, telemetry instrumentation (run_submitted, hitl_submitted, citation_clicked, allowlist_toggled, deadline_computed), and performance budgets (first load <3s on 3G-fast, interaction latency <150ms).
- QA checklist: navigation routing, keyboard-only flows (including HITL actions), localization switch, dark-mode contrasts, mobile bottom sheets, error states (“no official source”), skeleton loaders without layout shifts, security/role gating visuals, “What’s New” guided tour spanning Research → Drafting → HITL → Citations → Corpus.

#### F. Governance & Compliance
- Draft legal disclaimers, data processing agreements, TOJI-aligned responsible AI policy, incident response plan, and CEPEJ ethical charter implementation notes.
- Implement conflict-of-interest checks, access reviews, retention schedules, France-specific judge-analytics blocks, and global treaty alignment (Council of Europe AI Convention, Malabo Convention, GDPR, Rwanda Law 058/2021).
- Create governance dashboards summarizing agent usage, HITL outcomes, compliance metrics, FRIA status, and CEPEJ audit scores; attach download links for transparency reports and AI risk files.
- Prepare documentation for regulators/clients (model card, data flow diagrams, risk assessments, FRIA logs) and include references to LegalBench/LexGLUE evaluation benchmarks.

#### F1. Data Residency & Privacy Controls
- Produce a jurisdictional data-residency matrix covering EU/EEA, OHADA, Switzerland, Canada, and Rwanda with lawful basis catalogues, DPIA templates, and DPO playbooks per tenant.
- Partition Supabase storage and vector stores per residency envelope; encrypt sensitive corpora with KMS envelope keys and never expose service role secrets client-side.
- Capture cross-border transfer consents and map privacy obligations to GDPR, Rwanda Law No. 058/2021, and the AU Malabo Convention.

#### G. Launch & Operations
- Pilot onboarding playbook (data migration, integration setup, user training).
- Define service-level objectives (SLOs) and support processes.
- Establish change-management workflow (prompt updates, tool revisions, retraining, versioning).
- Create marketing collateral highlighting list pricing, ROI, differentiation, security posture.
- Run the Go / No-Go Release Checklist (`/ops/reports/GO_NO_GO_CHECKLIST.md`) before any pilot graduation or production launch; require sign-off and archival of the completed checklist.

#### H. Agent Learning & Continuous Improvement
- **Learning Goals**: Keep authoritative coverage fresh across OHADA, FR/BE/LU/EU, CH-FR, QC/CA, MA/TN/DZ, and Rwanda; lift retrieval precision, temporal validity, and binding-language accuracy; reduce HITL escalations without compromising caution.
- **Knowledge Layers**: Maintain Supabase Storage + OpenAI File Search vector store as the authoritative cache (official PDFs/HTML with metadata such as publisher, version, effective date, binding language); isolate internal corpora per organisation via RLS; persist telemetry (run outcomes, tool errors, reviewer edits) as learning signals.
- **Reinforced RAG Loop**:
  - *Collect*: Store retrieval sets, final IRAC payloads, citations, risk levels, and HITL decisions for every run.
  - *Diagnose*: Run automated checks for wrong versions, non-allowlisted domains, missing OHADA/EU overlays, and language-binding ambiguities.
  - *Generate Tickets*: Create indexing tickets for missing official documents, query-rewrite tickets for synonym gaps, and guardrail-tune tickets for allowlist/site: hint improvements.
  - *Evaluate*: Execute nightly golden-set evaluations (citation precision@1, temporal validity, binding-language warnings, HITL recall) and issue drift reports.
  - *Apply & Govern*: Update allowlist hints, synonym tables, prompt policies, and corpus snapshots with explicit versioning while excluding confidential client content unless the organisation opts in; never train on reviewer prose beyond routing/tuning metadata.
- **Data Model Additions**: Extend the database with `agent_learning_jobs`, `agent_synonyms`, `agent_policy_versions`, `tool_telemetry`, `case_scores`, `case_treatments`, `case_statute_links`, `risk_register`, and `case_score_overrides` tables while reusing `agent_runs`, `run_citations`, `eval_cases`, and `eval_results` for signals.
- **Schedulers**: Run daily authority crawls, ingestion, evaluation suites, and drift reports; process learning tickets hourly (indexing, synonyms, guardrail tweaks).
- **Acceptance Targets**: ≥95% allowlisted citation precision on golden sets; ≥95% temporal validity; 100% Maghreb binding-language banners when applicable; measurable downward trend in routine HITL rate.

#### H1. Evaluation & Benchmarking Enhancements
- Incorporate LegalBench and LexGLUE benchmark suites into CI to track legal reasoning and NLU regressions per jurisdiction.
- Extend nightly evaluations to include retrieval recall, citation fidelity (ELI/ECLI exact matches), hallucination audits, fairness drift monitoring (sensitive matter comparisons), and link-health checks that raise alerts when authorities change.
- Maintain post-market monitoring logs in line with the EU AI Act and CEPEJ principles, and publish quarterly transparency reports summarizing evaluation metrics, incidents, and remediation.

#### I. Agent Task Execution & Operations
- **Execution Model (Plan → Act → Verify → Log)**:
  - *Planner*: Route jurisdiction (including EU/OHADA flags), expand queries with code/abbreviation synonyms, and decide tool order and budgets.
  - *Executor*: Invoke tools within defined attempt/time budgets, preferring File Search before Web Search with automatic `site:` retries and allowlist enforcement.
  - *Verifier*: Validate IRAC outputs against the shared schema, re-check citations/domains/dates/binding status, and escalate to HITL on red flags (missing official source, version conflicts, Maghreb language uncertainty, penal/contentieux filings, sanctions risk, cross-border private international law conflicts).
  - *Logger*: Persist tool calls, retrieved sources, IRAC payloads, risk assessments, provenance hashes, and policy version IDs for full auditability.
- **Operational Rules**: Guarantee idempotent run keys per user/matter prompt for safe retries; enforce tool budgets, per-tool timeouts, and backoff on 429/5xx; implement per-org rate limits and long-job queues (e.g., bulk cite-check); define hard HITL triggers as listed above.
- **Task Types & Queues**: Support research answers, drafting, clause benchmarking/redlines, deadline calculations, cite-check/version diffs, authority snapshot requests, and corpus administration actions. Manage workload via `agent_task_queue` with priority, status, timestamps, and error tracking.
- **Acceptance**: Every run exposes a complete audit trail from inputs through tool activity to reviewer decisions; HITL actions mutate state and surface diffs/notes back to originators.

#### J. Agent Tools Registry & Guardrails
- **Tooling Surface**:
  - *Authority Retrieval*: Hosted Web Search with post-filtered allowlist and automatic retries; hosted File Search backed by the authoritative vector store with chunk-level citations.
  - *Legal Calculators & Lookups*: Function tools (`routeJurisdiction`, `lookupCodeArticle`, `deadlineCalculator`, `limitationCheck`, `interestCalculator`, `ohadaUniformAct`) with explicit input/output schemas, retry limits, and risk tiers.
  - *Document & Drafting Utilities*: `redlineContract` and `generateTemplate` tools returning diffs, rationales, citations, and fill-ins.
  - *Governance & Corpus Operations*: `checkBindingLanguage`, `snapshotAuthority`, and `validateCitation` tools to enforce binding-language warnings, provenance capture, and allowlist compliance.
- **Registry & Telemetry**: Track tool metadata in `agent_tools` (name, category, version, schemas, timeout, max retries, risk level, allowed domains) and log executions via `tool_telemetry` (latency, success, error codes).
- **Guardrails & Privacy**: Enforce allowlist both at query hinting and output rendering; require structured outputs (IRAC) with a single retry before HITL; ensure Confidential Mode disables Web Search and confines activity to File Search.
- **Acceptance**: Capture telemetry for all tool calls, never display non-allowlisted citations without explicit warnings/HITL escalation, and expose learning status indicators in admin analytics.

### 2.3 Timeline & Milestones
- **M0 (Weeks 0–4)**: Environment setup, core migrations, vector store bootstrap, base agent with FR/BE/LU/EU/OHADA coverage, initial UI skeleton.
- **M1 (Weeks 5–8)**: Maghreb integration with language warnings, Swiss & Québec enhancements, full function tools, ingestion automations.
- **M2 (Weeks 9–12)**: HITL dashboard, governance policies, evaluation harness completion, enterprise security features (SSO, audit logs).
- **M3 (Weeks 13–16)**: Performance hardening, red-team testing, compliance documentation, go-to-market enablement, pricing collateral.
- **Launch (Week 16)**: Transition pilots to production, monitor KPIs, gather feedback, plan iterative improvements.

### 2.4 Risk Register & Mitigations
- **Regulatory Non-Compliance**: Mitigate with stringent guardrails, HITL, legal review of disclaimers, and jurisdiction-specific counsel.
- **Source Availability**: Cache official documents in Supabase/OpenAI vector store; maintain manual fallback protocols and contact points with government portals.
- **Model Drift**: Schedule monthly evaluations, maintain prompt versioning, enable rollback mechanism.
- **Security Breach**: Enforce encryption, RBAC, logging, third-party audits, incident response drills.
- **User Misuse**: Implement rate limits, monitoring, training, and contractual clauses; escalate suspicious activity.

### 2.5 Financial & Pricing Considerations
- Infrastructure cost model: OpenAI usage (model + tools), Supabase (Pro tier), storage, CDN, monitoring.
- Profitability analysis based on list pricing vs. compute/storage costs; include safety buffer for high-usage clients.
- Budget allocation for professional services, compliance audits, and ongoing red-team exercises.

### 2.6 Jurisdictional Source & Connector Catalogue
| Jurisdiction / Overlay | Primary Statutes & Codes | Gazette / Official Journal | Case Law | Update Strategy |
| --- | --- | --- | --- | --- |
| France | Légifrance (codes consolidés, JO) | Journal Officiel (Légifrance) | Cour de cassation, Conseil d'État, Conseil constitutionnel | Daily sitemap poll for codes + JO feeds; weekly jurisprudence diff; hash + ELI tracking |
| Belgium | Justel (SPF Justice) | Moniteur belge | Cour de cassation (justice.belgium.be) | Daily Justel API pull, Moniteur RSS; monthly jurisprudence sweep |
| Luxembourg | Legilux | Mémorial/Legilux | Jurisprudence portal (justice.public.lu) | Weekly Legilux diff, monthly case update |
| Monaco | LégiMonaco | Journal de Monaco | Jurisprudence LégiMonaco | Weekly crawl with change detection |
| Switzerland (FR cantons) | Fedlex (fédéral), canton portals (GE, VD, VS, NE, FR, JU) | Feuille fédérale / Recueil officiel | Tribunal fédéral (bger.ch) + cantonal databases | Fedlex daily API; canton monthly; TF RSS ingestion |
| Québec / Canada | LégisQuébec (CQLR) | Gazette officielle du Québec | CanLII (QC & Supreme Court) | Weekly consolidation fetch; CanLII API weekly |
| OHADA (17 États) | Actes Uniformes (ohada.org) | Journal Officiel OHADA | CCJA (jurisprudence) | Monthly AU diff; CCJA releases ingestion |
| EU Overlay | EUR-Lex (ELI/CELEX) | JOUE | CJEU (Curia) | Daily eur-lex API queries filtered FR |
| Morocco | BO (sgg.gov.ma) incl. édition de traduction officielle | Bulletin Officiel | Cour de Cassation (justice.gov.ma) | Weekly BO crawl; monthly jurisprudence |
| Tunisia | JORT (iort.gov.tn) | JORT | Cour de cassation, cours d'appel (justice.gov.tn) | Weekly JORT fetch; monthly case update |
| Algeria | JO (joradp.dz) | Journal Officiel | Cour Suprême (journal-officiel) | Weekly JO ingestion; quarterly jurisprudence |
| Rwanda | Official Gazette (minijust.gov.rw, amategeko.gov.rw), Law Reform Commission (rlrc.gov.rw) | Official Gazette | Judiciary portal (judiciary.gov.rw) | Weekly Gazette pull; monthly case update |
| Sector Overlays | OAPI (IP), CIMA (insurance) | Bulletins / circulars | Arbitration/board decisions | Monthly change sweep |

> **Note:** Every connector stores provenance (publisher, publication date, effective date, binding language, hash) and queues `agent_learning_jobs` when a jurisdictional feed emits a non-allowlisted domain or missing metadata so Ops can remediate within SLA.

## 3. Ready-for-Production Checklist
- [ ] All migrations applied; RLS policies validated by automated tests.
- [ ] Vector store populated with up-to-date authoritative documents for every jurisdiction.
- [ ] Agents SDK orchestrator passes structured output validation and guardrail tests.
- [ ] HITL workflow operational with reviewer SLAs.
- [ ] Observability dashboards and alerts configured.
- [ ] Governance documentation approved by legal/compliance leads.
- [ ] Pricing model published with contract templates and service descriptions.
- [ ] Pilot clients trained and support processes tested.

## Appendix A – Codex Prompt: Build the Francophone Lawyer AI SaaS UI/UX

```yaml
codex_prompt:
  title: "Build the Francophone Lawyer AI SaaS UI/UX"
  intent: "Implement a production-grade, mobile-first, multi-tenant UI for an autonomous francophone lawyer AI agent (SaaS). No code generation in this prompt; generate the full front-end implementation when executing."
  global_rules:
    - "Additive-only changes; never break unrelated areas."
    - "Use OpenAI Agents SDK as first-class integration (already implemented backend endpoints)."
    - "Prefer authoritative legal sources; UI must always surface citations and binding status."
    - "French is default language; English optional."
    - "WCAG 2.2 AA accessibility; keyboard-first and screen-reader friendly."
    - "No chain-of-thought exposure; show plan/provenance only."

  foundations:
    stack:
      framework: "React + Next.js App Router (TypeScript)"
      styling: "Tailwind CSS + CSS variables (theming) + liquid-glass aesthetics"
      components: "shadcn/ui for primitives, lucide-react for icons, Framer Motion for micro-animations"
      state_data: "TanStack Query for server data; minimal local state with Zustand or Context"
      charts: "Recharts only where needed"
      pwa: "Installable PWA, offline shell for static UI (do not cache legal content)"
    i18n:
      default_language: "fr"
      supported_languages: ["fr", "en"]
      strings_location: "centralized messages catalog"
    responsiveness:
      targets: ["mobile-first", "tablet", "desktop (3-pane patterns)"]
    security:
      - "Role-based visibility across all screens"
      - "No sensitive data in client logs"
      - "Confidential Mode disables Web Search controls"
    performance_budgets:
      first_load: "<= 3s on 3G-fast"
      interaction_latency: "<= 150ms for common actions"
      bundle_discipline: "code-split per route; avoid blocking JS"
    design_language:
      typography:
        ui: "Inter or similar"
        long_form: "Readable serif for legal content"
      color:
        base: "Deep navy / near-black"
        gradients: ["teal→indigo", "violet→rose"]
        status: { success: "legal-green", warning: "legal-amber", error: "legal-red" }
      surfaces:
        style: "Liquid-glass cards, 20–28% blur, soft shadows, subtle noise"
      motion:
        duration_ms: "150–200"
        easing: "cubic-bezier(.2,.8,.2,1)"
        reduced_motion: "Respect prefers-reduced-motion"

  ux_rules:
    authority_first:
      - "Citations visible by default with badges: Officiel, Consolidé, Traduction, Jurisprudence"
      - "Show binding language (e.g., Arabic binding in Maghreb) and effective dates"
    agent_transparency:
      - "Agent Plan Drawer: high-level steps, tools invoked, provenance"
      - "Never display chain-of-thought"
    jurisdiction_first:
      - "Jurisdiction Router chip on every research prompt"
      - "OHADA Mode and EU Overlay flags when applicable"
    maghreb_language_banner:
      - "Sticky banner when MA/TN/DZ detected"
      - "Message: FR translation status vs Arabic binding + link to Arabic original"
    hitl:
      - "One-click ‘Soumettre à revue’"
      - "Review queue with approve / request changes / reject"
      - "Full audit trail per run"
    irac_output:
      - "Issue, Rules, Application, Conclusion as expandable accordion"
      - "Copy / export (PDF/DOCX) actions"

  navigation:
    app_shell:
      top_bar: ["Logo", "Global command bar (/)", "Notifications", "Org switcher", "Profile menu"]
      left_nav: ["Workspace", "Research", "Drafting", "Matters", "Citations", "HITL Review", "Corpus & Sources", "Admin"]
      mobile_fab: ["New Research", "Upload", "New Draft"]

  screens:
    workspace:
      goal: "One-screen control center"
      elements:
        - "Hero Ask Bar: 'Posez votre question juridique…' → opens Plan Drawer and routes to Research"
        - "Jurisdiction Chips with EU/OHADA indicators"
        - "Recent Matters cards with status (research/drafting/HITL)"
        - "Compliance Watch feed of authoritative updates"
        - "HITL Inbox with count badge"
      acceptance:
        - "Mobile/desktop parity"
        - "Keyboard-first focus management"
        - "All text in FR; screen-reader labels present"

    research:
      layout: "3-pane (desktop) / stacked (mobile)"
      left_query_tools:
        - "Prompt editor with Jurisdiction Router (auto + manual FR/BE/LU/CH/CA-QC/OHADA/Maghreb)"
        - "Toggles: OHADA Mode, EU Overlay, Confidential Mode (File Search only)"
        - "Filters: date, publication vs entry-into-force, consolidated-only"
      center_answer:
        - "IRAC Accordion with copy/export"
        - "Risk Banner: LOW/MED/HIGH + reason"
        - "HITL button"
        - "Opposing view toggle (when available)"
      right_evidence:
        - "Citations List with badges; click opens Citation Viewer"
        - "Version Timeline: original vs consolidated"
      acceptance:
        - "IRAC always present and collapsible"
        - "Badges/banners accurate (OHADA/EU/Maghreb)"
        - "‘Cannot verify official source’ state triggers HITL suggestion"

    drafting:
      components:
        - "Template Gallery (assignations, mises en demeure, contrats, PV, protocole d’accord)"
        - "Smart Draft (from prompt or uploaded doc)"
        - "Clause Library + Benchmark panel (alternatives with rationale + citations)"
        - "Live Redline: side-by-side, accept/reject, Explain modal"
      acceptance:
        - "Redlines smooth and performant"
        - "Rationale chips visible with links to sources"
        - "Export DOCX/PDF via server call"

    matters:
      sections:
        - "Overview: parties, venues, governing law, risk, timeline"
        - "Timeline: Deadline Wizard with computation notes"
        - "Documents: tree, search, multi-select compare; Cite-Check pass indicator"
        - "Calendar: ICS export"
      acceptance:
        - "Deadlines show calculation method and timezone"
        - "Tooltips for procedure rules"

    citations_browser:
      features:
        - "Search official sources only; filters for jurisdiction, type, dates"
        - "Document Viewer: TOC (articles) • Canvas (article anchors) • Metadata (publisher, dates, binding, consolidation)"
        - "Compare versions with diff highlights"
        - "OHADA tab: Uniform Acts + CCJA digest first"
      acceptance:
        - "Anchors scroll precisely"
        - "Diff view clear and performant"

    hitl_review:
      features:
        - "Queue Table with filters (risk, translation caveat, litigation)"
        - "Review Screen: IRAC, sources, deltas vs latest law"
        - "Actions: Approve / Request changes / Reject"
        - "Comment box, audit trail"
      acceptance:
        - "Actionable in ≤2 clicks"
        - "Status updates visible immediately"

    corpus_sources:
      features:
        - "Allowlist Manager: domains per jurisdiction; toggle active with info tooltip"
        - "Snapshots: ingested PDFs/HTML with checksums/dates; search"
        - "File Search Corpora: upload official docs; ingestion status"
      acceptance:
        - "Role-gated actions"
        - "UI state reflects changes instantly"

    admin:
      features:
        - "Organizations & Roles: invite, assign (owner/admin/member/reviewer)"
        - "Billing: seats, metered runs, invoices (placeholders)"
        - "Security: SSO/SAML placeholders, IP allowlisting, DLP toggles"
        - "Policies: thresholds (cite-or-refuse, HITL), retention"
      acceptance:
        - "RLS-sensitive views: non-members do not see other org data"

  components:
    - name: "AppShell"
      purpose: "Top bar + collapsible nav + content"
    - name: "JurisdictionChip"
      purpose: "Country code with EU/OHADA badges; opens router drawer"
    - name: "PlanDrawer"
      purpose: "Outline agent’s steps, tools invoked, provenance"
    - name: "IRACAccordion"
      purpose: "Issue/Rules/Application/Conclusion with copy/export"
    - name: "CitationCard"
      purpose: "Title, publisher, date, badges, link"
    - name: "VersionTimeline"
      purpose: "Navigate original vs consolidated versions"
    - name: "RiskBanner"
      purpose: "Show risk level with reason; HITL action"
    - name: "LanguageBanner"
      purpose: "Maghreb binding-language warning"
    - name: "RedlineDiff"
      purpose: "Two-column legal redline with accept/reject per suggestion"
    - name: "DeadlineWizard"
      purpose: "Compute deadlines; show methodology notes"
    - name: "HITLQueueTable"
      purpose: "Filterable reviewer queue with bulk actions"
    - name: "AuthorityViewer"
      purpose: "TOC + content + metadata for official sources"
    - name: "SourceBadge"
      purpose: "Officiel / Consolidé / Traduction / Jurisprudence"
    - name: "EmptyState"
      purpose: "Contextual guidance when no data"
    - name: "ErrorState"
      purpose: "Actionable errors (e.g., no official source)"

  mobile_pwa_addendum:
    mobile_information_design:
      - "Provide three mobile reading modes (Research, Brief, Evidence) with quick toggles; Research keeps dense inline citations, Brief collapses IRAC with serif typography, Evidence prioritises article-level viewers and version switchers."
      - "Support article-level anchors across the stack so tapping a citation scrolls and highlights the exact article/paragraph with a copy-ready ELI/ECLI payload."
      - "Adopt progressive disclosure: surface TL;DR summaries before expanding IRAC sections, opposing views, or detailed evidence."
      - "Deliver mobile-first compare flows that default to single-column summaries (accepted/rejected counts, risky clauses) before offering side-by-side when landscape is available."
    navigation_patterns:
      - "Expose a safe-area aware bottom navigation bar (Home, Research, Drafting, Queue) with a centred FAB for “Ask” on mobile while preserving desktop side navigation."
      - "Offer a command palette accessible via `/` or long-press on the FAB to create research, open matters, trigger cite-checks, or compute deadlines, and ensure every IRAC answer, version diff, and citation viewer has deep-linkable URLs with reliable back gestures."
    input_ergonomics:
      - "Enable voice dictation for prompts (legal punctuation aware), camera-to-OCR ingestion for stamps/seals, and OS share targets that push PDFs/URLs/images directly into the Evidence Inbox."
    accessibility_readability:
      - "Respect WCAG 2.2 AA+ by using 16–20px base typography with 1.6–1.7 line heights, optical margins for quotes, ≥44px tap targets, sticky HITL CTAs, ARIA landmarks/headings, skip links, focus traps, and text-to-speech actions respecting reduced-motion preferences."
      - "Validate liquid-glass gradients maintain ≥4.5:1 contrast and ensure screen reader labelling spans navigation, drawers, and bottom sheets."
    trust_provenance_ui:
      - "Attach authority ribbons (Officiel/Consolidé/Traduction/Jurisprudence) and staleness chips (“last verified” with refresh) to every citation; surface case score badges with drill-downs for axis contributions and statute alignment snippets."
      - "Display Maghreb binding-language banners and Canadian bilingual toggles in-context with responses, not hidden in settings."
    pwa_excellence:
      - "Ship a full PWA with install cues post-success (two completed searches), manifest shortcuts (New Research, Draft, Review), standalone display, dark/light icons, and platform splash screens."
      - "Implement Workbox runtime strategies: Stale-While-Revalidate for the shell, Network-First for official law, no-store for client uploads unless an encrypted local cache is explicitly enabled."
      - "Hit Core Web Vitals budgets (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 on mid-range Android) and treat the FAB, bottom nav, and command palette as progressive enhancements when offline."
    privacy_mobile:
      - "Confidential Mode must visibly disable Web Search, blur multitasking previews, block screenshots (Android FlagSecure), and avoid caching private docs; offer optional encrypted per-org caches with expiry labels for field work."
    micro_interactions:
      - "Add lightweight haptics for redline decisions and HITL submissions, skeleton states with optimistic toggles for allowlist and queue updates, and legal microcopy (“Sources non officielles – re-cherche en cours…”, “Version consolidée au 2025-09-01”)."
    layout_tokens:
      - "Respect safe-area insets, provide a sticky secondary toolbar (Copy, Export, Explain, HITL) under the Research header, allow density switching (Comfortable/Compact), and ensure diff/score palettes are colour-blind safe."
    offline_behavior:
      - "When offline, show the last verified answer with a red “verify now” action, disable submissions that require network-only tools, autosave prompts locally (and encrypt when Confidential Mode is active), and queue uploads/prompts in an Outbox with retries."
    notifications_exports:
      - "Support opt-in push for matter updates, due dates, HITL assignments, and weekly jurisdiction digests, and guarantee print/export paths deliver C2PA-signed PDFs/DOCX with bibliographies (A4 and Letter)."
    internationalization_errors:
      - "Apply locale-aware typography and punctuation (e.g., French thin spaces, Rwanda FR/EN/RW triage with appropriate fonts), and handle error states gracefully: no official source (with site: hints + HITL), version conflicts (dual view + HIGH risk banner), and paywalled access prompts for credentials."
    qa_acceptance:
      - "Augment the QA checklist with PWA requirements: installability on Android/iOS, verified service worker strategies without caching private docs, offline stale states with Outbox retries, bottom nav + FAB availability, article anchor highlighting at 320px widths, Maghreb and Canada banners visible in answers, Confidential Mode safeguards, Core Web Vitals budget reports, and signed exports."
    quick_wins:
      - "Introduce staleness chips and “Verify now” actions on citation cards, an Outbox with retry controls for uploads/prompts, voice input plus camera OCR from the FAB, Confidential Mode UI enhancements (blur previews, no local cache), and 44px tap targets with sticky HITL CTA on mobile Research views."

  data_integration:
    backend_contracts:
      - method: "POST"
        route: "/api/runs"
        returns: ["IRAC JSON", "citations", "risk", "run_id", "timeline", "audit refs"]
      - method: "GET"
        route: "/api/runs/:id"
        returns: ["IRAC", "sources", "tool calls", "audit"]
      - method: "POST"
        route: "/api/upload"
        returns: ["ingestion status", "doc ids"]
      - method: "GET"
        route: "/api/search-local"
        returns: ["top-k local chunks (diagnostic)"]
      - method: "GET"
        route: "/api/citations"
        returns: ["recent authoritative updates"]
      - method: "GET"
        route: "/api/hitl"
        returns: ["review queue"]
      - method: "POST"
        route: "/api/hitl/:id"
        body: ["approve | request_changes | reject", "comment"]
      - method: "GET"
        route: "/api/corpus"
        returns: ["allowlist domains", "snapshots", "corpora items"]
      - method: "PATCH"
        route: "/api/corpus/allowlist/:domain"
        body: ["active: boolean"]
      - method: "GET"
        route: "/api/matters"
        returns: ["list of matters"]
      - method: "GET"
        route: "/api/matters/:id"
        returns: ["matter detail"]
      - method: "POST"
        route: "/api/matters"
        body: ["create/update metadata"]
      - method: "GET"
        route: "/api/deadline"
        query: ["jurisdiction", "procedure_type", "start_date"]
        returns: ["deadline_date", "notes", "risk_flags"]
    client_expectations:
      - "Use query keys per route; sensible caching"
      - "Show skeletons for loading; toasts for success/error"
      - "Retry policy for transient errors"
      - "Optimistic updates only for safe toggles (allowlist)"

  feature_flags:
    - "Confidential Mode (File Search only)"
    - "OHADA Mode"
    - "EU Overlay"
    - "Citizen Tier (optional simplified flow)"

  accessibility:
    requirements:
      - "Keyboard navigation across every interactive element"
      - "ARIA roles/labels on IRAC, Plan Drawer, Evidence list"
      - "Skip links and visible focus rings"
      - "High-contrast themes for light/dark modes"
      - "Localization for dates/times/numbers"
    mobile_patterns:
      - "Bottom sheets for secondary actions"
      - "Sticky primary CTA (HITL) on research detail"

  telemetry:
    events:
      - "run_submitted"
      - "hitl_submitted"
      - "citation_clicked"
      - "allowlist_toggled"
      - "deadline_computed"
    error_categories:
      - "no_official_source"
      - "consolidation_mismatch"
      - "binding_language_uncertain"
      - "network_error"
    dashboards:
      - "Citations Accuracy (allowlisted rate, retries)"
      - "Temporal Validity (%)"
      - "HITL: approval time, change rate"
      - "Model Health: failure types"
      - "Corpus Coverage by jurisdiction"

  acceptance_criteria:
    - "Research answers always show IRAC + Citations with badges and binding/consolidation info"
    - "Jurisdiction Router + OHADA/EU flags visible on every research prompt"
    - "Language Banner appears for Maghreb jurisdictions when applicable"
    - "HITL flow operable end-to-end (queue → review → action → status updated)"
    - "Authority Browser anchors and version compare precise and performant"
    - "Mobile-first, WCAG 2.2 AA, French default text fully localized"

  qa_checklist:
    navigation:
      - "All routes accessible; deep links work"
      - "Keyboard-only navigation possible"
    localization:
      - "FR/EN toggle changes all visible strings and formats"
    dark_mode:
      - "Badges, banners, gradients legible"
    mobile:
      - "3-pane research collapses; drawers/bottom sheets work one-handed"
    error_states:
      - "Simulate ‘no official source’: show refusal + HITL CTA"
    performance:
      - "Skeletons for slow queries; no major layout shifts"
    security:
      - "Role-gated views (Admin, Corpus) hidden for non-authorized users"

  deliverables:
    - "Fully implemented front-end app matching all screens/components"
    - "Design tokens for gradients, glass surfaces, status colors"
    - "Fixtures/mocks for runs/citations/matters if backend not live"
    - "‘What’s New’ tour showcasing Research → Drafting → HITL → Citations → Corpus"
```

---
This document provides the BELL analysis and the detailed steps required to deliver the Avocat-AI Francophone agent as a production-ready, list-priced autonomous legal solution across the targeted francophone jurisdictions.

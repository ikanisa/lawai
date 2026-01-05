# LawAI Audit (Evidence-Based)

## Scope and Evidence
This audit is limited to the files explicitly cited inline in each section. No assumptions are made beyond those sources.

## Feature Map (Current Behavior)
- Next.js operator console with workspace, research, drafting, corpus, citations, trust, HITL, matters, admin, auth, and staff views wired via App Router pages. Sources: `apps/web/app/page.tsx` (root redirect), `apps/web/app/[locale]/workspace/page.tsx`, `apps/web/app/[locale]/research/page.tsx`, `apps/web/app/[locale]/drafting/page.tsx`, `apps/web/app/[locale]/corpus/page.tsx`, `apps/web/app/[locale]/citations/page.tsx`, `apps/web/app/[locale]/trust/page.tsx`, `apps/web/app/[locale]/hitl/page.tsx`, `apps/web/app/[locale]/matters/page.tsx`, `apps/web/app/[locale]/admin/page.tsx`, `apps/web/app/[locale]/auth/page.tsx`, `apps/web/app/[locale]/staff/page.tsx`.
- Workspace dashboard shows matters, jurisdiction chips, HITL inbox, and a plan drawer CTA. Sources: `apps/web/src/components/workspace/workspace-view.tsx` (WorkspaceView).
- Research flow submits questions to `/runs`, renders IRAC output, citations, risk banner, plan drawer, reading modes, and outbox. Sources: `apps/web/src/components/research/research-view.tsx`, `apps/web/src/lib/api.ts` (submitResearchQuestion).
- Drafting view lists template categories, smart draft form, and redline diff with citations. Sources: `apps/web/src/components/drafting/drafting-view.tsx`, `apps/web/src/components/drafting/redline-diff.tsx`.
- Citations browser supports search/filtering, snapshot comparison diff view, and citation metadata display. Sources: `apps/web/src/components/citations/citations-browser.tsx`, `apps/web/src/lib/api.ts` (fetchCitations, fetchSnapshotDiff).
- Corpus view shows allowlist domains, snapshots with summary status, uploads, and ingestion runs plus resummarize actions. Sources: `apps/web/src/components/corpus/corpus-view.tsx`, `apps/web/src/lib/api.ts` (fetchCorpus, resummarizeDocument).
- HITL console lists queue items, metrics, audit trail, and reviewer actions. Sources: `apps/web/src/components/hitl/hitl-view.tsx`, `apps/web/src/lib/api.ts` (fetchHitlQueue, fetchHitlMetrics, fetchHitlDetail, submitHitlAction).
- Trust center renders operations overview and governance publications. Sources: `apps/web/src/components/trust/trust-center-view.tsx`, `apps/web/src/lib/api.ts` (getOperationsOverview, getGovernancePublications).
- Admin view surfaces governance metrics, retrieval metrics, evaluations, SLO, SSO/SCIM, audit events, and IP allowlist. Sources: `apps/web/src/components/admin/admin-view.tsx`, `apps/web/src/lib/api.ts`.
- Deprecated PWA surface exists but is explicitly marked deprecated. Source: `apps/pwa/DEPRECATED.md`.

## UI/UX Routes and Personas
### Route Map (App Router)
- `/` redirects to `/fr/workspace`. Source: `apps/web/app/page.tsx` (redirect call).
- Locale-scoped routes: `/[locale]/workspace`, `/[locale]/research`, `/[locale]/drafting`, `/[locale]/corpus`, `/[locale]/citations`, `/[locale]/trust`, `/[locale]/hitl`, `/[locale]/matters`, `/[locale]/admin`, `/[locale]/auth`, `/[locale]/staff`, `/[locale]/workspace/security`. Sources: `apps/web/app/[locale]/workspace/page.tsx`, `apps/web/app/[locale]/research/page.tsx`, `apps/web/app/[locale]/drafting/page.tsx`, `apps/web/app/[locale]/corpus/page.tsx`, `apps/web/app/[locale]/citations/page.tsx`, `apps/web/app/[locale]/trust/page.tsx`, `apps/web/app/[locale]/hitl/page.tsx`, `apps/web/app/[locale]/matters/page.tsx`, `apps/web/app/[locale]/admin/page.tsx`, `apps/web/app/[locale]/auth/page.tsx`, `apps/web/app/[locale]/staff/page.tsx`, `apps/web/app/[locale]/workspace/security/page.tsx`.
- Admin panel subroutes (App Router segment): `/[locale]/admin/(panel)/overview`, `/billing`, `/corpus`, `/telemetry`, `/agents`, `/evaluations`, `/ingestion`, `/people`, `/workflows`, `/hitl`, `/audit-log`, `/jurisdictions`, `/policies`. Sources: `apps/web/app/[locale]/admin/(panel)/overview/page.tsx` and the sibling `page.tsx` files in the same folder.

### Personas and Roles
- Workspace personas (bench_memo, procedural_navigator, negotiation_mediator, evidence_discovery) and their routing targets are defined server-side. Source: `apps/api/src/domain/workspace/navigator.ts` (personas array with `agentCode`, `href`, `label`, `guardrails`).
- The UI renders these personas on the multi-agent desk. Source: `apps/web/src/components/workspace/multi-agent-desk.tsx` (rendering `desk.personas`).
- Role/permission model (viewer/member/reviewer/compliance_officer/auditor/org_admin/system_admin) and route permissions are defined in shared RBAC constants. Source: `packages/shared/src/roles.ts` (ROLES, PERMISSIONS, ROUTE_PERMISSIONS).
- The Supabase/agent manifest lists a different RBAC role set (owner/admin/member/reviewer/viewer/etc). Source: `docs/SUPABASE_AND_AGENT_MANIFEST.yaml` (rbac section). This indicates multiple role vocabularies exist in the repo.

## Agent Logic (Prompts, Tools, Retrieval, Citations)
### Prompt/Instruction Assembly
- Runtime instructions are built in `buildInstructions`, including IRAC requirement, tool usage, allowlisted sources, confidential mode behavior, and jurisdiction hints. Source: `apps/api/src/agent.ts` (function `buildInstructions`).
- The IRAC output schema is enforced by a shared Zod schema. Source: `packages/shared/src/irac.ts` (IRACSchema).
- A Codex prompt file exists but is referenced as a planning artifact rather than runtime code. Sources: `prompts/francophone_lawyer_agent_prompt.yaml`, `docs/implementation_guide.md` (Backend Codex Prompt reference).

### Tools (Function + Hosted)
- Tool definitions: `route_jurisdiction`, `lookup_code_article`, `deadline_calculator`, `ohada_uniform_act`, `limitation_check`, `interest_calculator`, `check_binding_language`, `validate_citation`, `redline_contract`, `snapshot_authority`, `evaluate_case_alignment`, `generate_pleading_template`. Source: `apps/api/src/agent.ts` (function `buildAgent` tool declarations).
- Hosted tools: `file_search` always enabled; `web_search` enabled unless confidential mode; both have budget enforcement. Source: `apps/api/src/agent.ts` (fileSearchTool/webSearchTool setup).

### Retrieval/RAG
- Hybrid retrieval plan step blends Supabase `match_chunks` RPC with OpenAI File Search results, and injects summarized snippets into the prompt. Sources: `apps/api/src/agent.ts` (functions `planRun`, `fetchHybridSnippets`, `summariseSnippets`).
- OpenAI vector store client is used for research search. Sources: `apps/api/src/routes/research/index.ts` (vector store query), `apps/api/src/openai.ts` (getVectorStoreClient).
- File search and web search utilities use the OpenAI Responses API and extract citations. Sources: `apps/api/src/services/file-search.ts`, `apps/api/src/services/web-search.ts`.

### Citation Behavior and Guardrails
- Allowlist enforcement uses an output guardrail plus post-run verification; violations trigger retries or HITL escalation. Sources: `apps/api/src/agent.ts` (citationsAllowlistGuardrail, verifyAgentPayload, executeAgentPlan).
- Binding-language notices are injected into citation notes and risk reasons based on jurisdiction/domain rules. Sources: `apps/api/src/agent.ts` (JURISDICTION_BINDING_RULES, DOMAIN_BINDING_RULES, applyBindingLanguageNotices).
- Allowlisted domain registry is centralized in shared constants. Source: `packages/shared/src/constants/allowlist.ts` (OFFICIAL_DOMAIN_REGISTRY, OFFICIAL_DOMAIN_ALLOWLIST).
- Trust panel summarizes allowlist ratio, translation warnings, binding notes, and retrieval provenance. Source: `apps/api/src/agent.ts` (buildTrustPanel, buildTrustPanel metadata aggregation).

## Data Model and Supabase Usage
### Declared Schema/Contracts
- Canonical tables, RPCs, views, and tool contracts are declared in the manifest. Source: `docs/SUPABASE_AND_AGENT_MANIFEST.yaml`.

### Service Client and Access
- Supabase service client uses the service role key and disables session persistence. Sources: `packages/supabase/src/client.ts`, `apps/api/src/supabase-client.ts`.

### API Data Access (Examples)
- Agent runs persist IRAC payloads, tool logs, retrieval sets, telemetry, citations, audit events, compliance assessments, and HITL queue entries. Source: `apps/api/src/agent.ts` (function `persistRun` and HITL insert logic).
- Corpus endpoints query allowlist domains, documents (authorities/uploads), ingestion runs, and document summaries. Source: `apps/api/src/server.ts` (route `/corpus`).
- Corpus helper pulls `authority_domains`, `documents`, `upload_ingestion_jobs`, and `org_policies`. Source: `apps/api/src/routes/corpus/data.ts`.
- Research search endpoint uses OpenAI vector store query and returns filters/results. Source: `apps/api/src/routes/research/index.ts`.
- Document summarization + embeddings pipeline uses OpenAI responses and embeddings. Source: `apps/api/src/summarization.ts`.

## Security/Privacy Risks (Client Data, Uploads, Storage)
All items below are derived from code/docs; no external assumptions.
- Local storage outbox persists user questions and context when not in confidential mode. Sources: `apps/web/src/hooks/use-outbox.ts` (localStorage), `apps/web/src/components/research/research-view.tsx` (persist toggled by confidential mode).
- Service worker caches `/api/uploads` and `/api/official` responses, plus static assets/images, which can retain client data on device. Source: `apps/web/src/service-worker/sw.ts`.
- Prompt injection detection rejects requests but includes a TODO to log to audit events (currently not implemented). Source: `apps/api/src/agent-wrapper.ts` (TODO comment).
- CSP allows `'unsafe-inline'` in scripts/styles and `'unsafe-eval'` in non-production, which is called out as a residual risk in policy. Sources: `apps/api/src/security/policies.ts` (buildContentSecurityPolicy), `SECURITY.md` (Threat Modeling section).
- Demo org/user IDs are hardcoded in web API helpers, implying shared identity context in the UI layer. Sources: `apps/web/src/lib/api.ts` (DEMO_ORG_ID/DEMO_USER_ID), `docs/agents/repo-analysis.md` (explicit finding).

## Gaps vs ChatGPT App Review Readiness (Evidence-Based)
No explicit ChatGPT app review checklist or artifacts are present in the cited sources. Gaps below are derived from concrete mismatches and placeholders in the repo:
- Real auth/session wiring is not present in the web client; demo IDs are used across API calls. Sources: `apps/web/src/lib/api.ts` (DEMO_ORG_ID/DEMO_USER_ID), `docs/agents/repo-analysis.md` (front-end finding).
- Some API surfaces are implemented both as stubs and full endpoints, indicating duplication and potential inconsistencies. Sources: `apps/api/src/app.ts` (registers stub routes), `apps/api/src/routes/citations/index.ts`, `apps/api/src/routes/hitl/index.ts`, `apps/api/src/routes/corpus/index.ts`, `apps/api/src/server.ts` (full implementations), `apps/api/package.json` (dev uses `src/server.ts`).
- Supabase Edge Functions for ingestion and learning are placeholders that log payloads rather than performing real work. Source: `supabase/functions/crawl-authorities/index.ts` (placeholder comment and response).
- Security policy includes placeholder contact info and notes about incomplete hardening. Source: `SECURITY.md` (security@avocat-ai.example, container hardening in progress).
- Role vocabularies differ between shared RBAC constants and the manifest, which complicates consistent policy enforcement. Sources: `packages/shared/src/roles.ts`, `docs/SUPABASE_AND_AGENT_MANIFEST.yaml` (rbac section).


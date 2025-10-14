# Gaps & Fix List

1. **Google Drive ingestion pipeline (BLOCKER)**  
   - **Gap**: No Drive watcher, manifest validator, or quarantine workflow was implemented.  
   - **Fix**: Build an Edge Function + Ops worker that consumes Drive change notifications, validates manifests per `gdrive_corpus_blueprint`, and feeds the existing normalization/upload path with quarantine + alert hooks.

2. **Document summarisation & chunk QA (HIGH)**  
   - **Gap**: Crawl pipeline uploads raw files without structured summaries; chunking only happens in the manual CLI.  
   - **Fix**: Add a summarisation microservice (OpenAI Structured Outputs) that stores outlines in Supabase, enforces article-level anchors, and triggers local chunk embeddings automatically after ingestion.

3. **Function tool parity (HIGH)**  
   - **Gap**: `generatePleadingTemplate` function tool described in the plan is absent from the agent orchestrator.  
   - **Fix**: Implement the tool with Supabase-backed templates and register it with the Agents SDK.

4. **Confidential Mode enforcement (HIGH)**  
   - **Gap**: UI exposes Confidential Mode toggle but API ignores it; web search still executes.  
   - **Fix**: Propagate the flag through `/runs`, disable web search tool when active, and log confidentiality scope in `agent_runs`.

5. **Governance collateral & dashboards (MEDIUM)**  
   - **Gap**: No responsible-AI policies, SLO dashboards, or pilot playbooks committed despite checklist requirements.  
   - **Fix**: Author policy docs, create Supabase dashboard queries, and add operations handbook to `/docs`.

6. **Authority browser diffing (MEDIUM)**  
   - **Gap**: Citations browser lists sources but lacks version diff/highlight views promised in the plan.  
   - **Fix**: Implement side-by-side diff component fed by `/api/corpus` snapshots.

7. **Supabase Cron wiring (MEDIUM)**  
   - **Gap**: No scheduled tasks defined for `crawl-authorities` or `process-learning`.  
   - **Fix**: Commit `supabase/config.json` with cron definitions (daily crawl, hourly learning processor) or document CLI deployment steps in `/docs/operations.md`.

8. ~~**Evaluation metrics storage (MEDIUM)**~~ ✅
   - Résolu: L'outil d'évaluation consigne désormais les métriques (précision, validité temporelle, bannière Maghreb) dans `eval_results` et la CI échoue si les seuils de Phase 2 régressent.

9. **Security reviews & access controls (LOW)**  
   - **Gap**: No evidence of IP allowlisting, DLP toggles, or audit dashboards in Admin UI.  
   - **Fix**: Implement toggles hitting `/api/admin` endpoints and extend schema for audit logs.

10. **Pilot launch collateral (LOW)**  
    - **Gap**: Pricing collateral, onboarding runbooks, and GTM assets not yet written.  
    - **Fix**: Add `/docs/launch` package with pricing sheet, onboarding checklist, and change-management SOP.

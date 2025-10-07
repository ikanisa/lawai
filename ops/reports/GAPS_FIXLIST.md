# Gaps & Fix List

1. ~~**Google Drive ingestion pipeline (BLOCKER)**~~ ✅
   - Résolu : Le worker `drive-watcher` valide les manifests `gdrive_corpus_blueprint`, alimente le pipeline de normalisation, isole les éléments en quarantaine et journalise les notifications dans Supabase.【F:apps/edge/drive-watcher/index.ts†L1-L258】【F:db/migrations/0015_drive_manifests.sql†L1-L30】

2. ~~**Document summarisation & chunk QA (HIGH)**~~ ✅
   - Résolu : Les ingestions déclenchent la génération de résumés structurés (`document_summaries`), rafraîchissent les chunks vectoriels et valident les ancres Akoma Ntoso automatiquement après chaque upload.【F:apps/edge/crawl-authorities/index.ts†L1018-L1228】【F:db/migrations/0033_document_summaries.sql†L1-L23】

3. ~~**Function tool parity (HIGH)**~~ ✅
   - Résolu : L’agent enregistre désormais `generatePleadingTemplate`, s’appuie sur les modèles Supabase seedés et expose l’outil via les tests de planning.【F:apps/api/src/agent.ts†L3768-L3860】【F:db/migrations/0017_pleading_templates.sql†L1-L15】【F:db/seed/seed.ts†L351-L372】

4. ~~**Confidential Mode enforcement (HIGH)**~~ ✅
   - Résolu : Le backend propage le mode confidentiel, désactive le Web Search, évite les caches hybrides et archive le scope dans `agent_runs`, tandis que l’UI affiche bannière et télémétrie dédiées.【F:apps/api/src/agent.ts†L334-L401】【F:apps/web/src/components/app-shell.tsx†L1-L200】

5. ~~**Governance collateral & dashboards (MEDIUM)**~~ ✅
   - Résolu : L’ensemble des politiques (responsible AI, CEPEJ, CoE, DPIA, support, régulateurs) est publié en interne et sur `/public/governance`, alimentant le tableau de bord admin et les nouvelles cartes “Trust Center”.【F:docs/governance/support_runbook.md†L1-L42】【F:apps/web/public/governance/support_runbook.md†L1-L31】【F:apps/web/src/components/governance/operations-overview-card.tsx†L1-L210】

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

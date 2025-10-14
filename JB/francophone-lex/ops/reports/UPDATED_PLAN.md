# Updated Plan for Remaining Work

## 1. Data Ingestion & Provenance
- **Operationalise Google Drive watcher alerts** (owner: Data)
  Dependencies: Google API service account, Supabase service role.  
  Milestone: `M0+2w`.
- **Integrate OCR & Akoma Ntoso metadata** (owner: Data/ML)
  Plug Tesseract/Cloud Vision into the summarisation pass for scanned gazettes and persist Akoma Ntoso anchors alongside summaries.
  Milestone: `M0+4w`.
- **Publish Supabase Cron schedule** (owner: DataOps)  
  Commit cron definitions for `crawl-authorities` and `process-learning`, including health alerts.  
  Milestone: `M0+1w`.

## 2. Agent Orchestration & Tools
- **Add `generatePleadingTemplate` function tool** (owner: Backend)  
  Schema: Supabase `legal_templates` table + caching.  
  Milestone: `M0+1w`.
- **Respect Confidential Mode** (owner: Backend)  
  Pass flag from UI → `/runs`, disable web search + redact telemetry when true.  
  Milestone: `M0+1w`.

## 3. Retrieval, Evaluation & Learning
- ~~**Persist evaluation metrics** (owner: Ops)~~ ✅ Livré
  Les métriques de précision, validité temporelle et couverture Maghreb sont enregistrées et vérifiées en CI.
- **Dashboard telemetry** (owner: Ops/Frontend)  
  Add Admin analytics (citations accuracy, HITL trend, corpus coverage).  
  Milestone: `M1`.

## 4. Operator Experience
- **Authority diff viewer** (owner: Frontend)  
  Provide side-by-side diff + anchor navigation for `/citations`.  
  Milestone: `M0+2w`.
- **HITL audit enhancements** (owner: Backend/Frontend)  
  Surface reviewer notes, status timeline, and policy version tag.  
  Milestone: `M0+2w`.

## 5. Governance & Launch
- **Responsible AI policy pack** (owner: Legal/Compliance)  
  Draft DPA, incident response, TOJI-aligned policy, conflicts procedure.  
  Milestone: `M1`.
- **Pilot onboarding kit** (owner: PMO)  
  Produce onboarding checklist, training deck, SLO runbooks, pricing collateral.  
  Milestone: `M1`.

## 6. Security & Privacy
- **Admin security toggles** (owner: Backend/Frontend)  
  Implement IP allowlisting/DLP toggles, connect to Supabase policies.  
  Milestone: `M1`.
- **Audit logging expansion** (owner: Backend)  
  Log policy version, Confidential Mode, tool retries; expose via API.  
  Milestone: `M0+3w`.

## 7. Validation & QA
- **Golden-set expansion** (owner: Ops)  
  Add 20+ prompts per jurisdiction covering corporate, labor, PIL, enforcement.  
  Milestone: `M0+4w`.
- **WCAG verification & mobile regression** (owner: QA)  
  Run axe + manual keyboard audits across UI screens.  
  Milestone: `M0+2w`.

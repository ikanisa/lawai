# Go / No-Go Release Checklist

A. Law, Ethics, and Policy

- [ ] France judge-analytics ban: hard block of any judge profiling/score; redaction pipeline verified (FR tenants).
- [ ] EU AI Act (high-risk): FRIA completed; HITL checkpoints enabled; post-market monitoring plan logged. *(Les dossiers FRIA validés doivent être enregistrés via l'API `POST /admin/org/:orgId/go-no-go/fria` pour que la commande `pnpm ops:go-no-go --require-go` passe.)*
- [ ] CEPEJ 5 principles: tests baked into CI (fundamental rights, non-discrimination, quality/security, transparency/fairness, user control).
- [ ] OHADA pre-emption: automatic pre-emption banner where Uniform Acts govern; CCJA priority enforced.
- [ ] Canada (QC/federal): bilingual equality (both language versions surfaced and equal force).
- [ ] Rwanda privacy law & AU Malabo: data-handling templates, DPIA, cross-border controls.
- [ ] Client disclosures & ToS updated (AI-assistance, human responsibility).

B. Data Sources & Provenance

- [ ] Official allowlists complete (FR, BE, LU, CH-FR, CA-QC, MC, MA, TN, DZ, RW, OHADA, EU, OAPI, CIMA).
- [ ] ELI/ECLI IDs stored; Akoma Ntoso mapping for statutes/cases where available.
- [x] Snapshot hashing (SHA-256), C2PA signing for exported briefs.
- [ ] Coverage smoke test: ≥50 docs per jurisdiction ingested; zero broken canonical links.

C. Retrieval, Reasoning, and Scoring

- [ ] Statute-first policy enforced; time/entry-into-force gates on.
- [ ] Case reliability scoring live (PW/ST/SA/PI/JF/LB/RC/CQ); treatment graph constructed; hard blocks on overruled/vacated.
- [ ] Maghreb binding-language banners (Arabic vs FR) verified; Rwanda FR/EN/Kinyarwanda triage.
- [ ] Sensitive-topic gates → HITL (e.g., penal, elections, national security).

D. Agent & Tools (OpenAI Agents SDK)

- [ ] Tools registered: web_search, file_search, routeJurisdiction, lookupCodeArticle, ohadaUniformAct, deadlineCalculator, limitationCheck, redlineContract, generateTemplate, validateCitation, checkBindingLanguage, snapshotAuthority, computeCaseScore.
- [ ] Structured Outputs (IRAC) always returned; guardrails: citations_allowlist + binding_language + sensitive_topic_hitl.
- [ ] Budgets/timeouts set; retries & refusal paths tested.

E. Security & Privacy (Supabase + infra)

- [ ] RLS enabled on all tenant tables; secrets server-side; Storage paths scoped to org.
- [ ] Encryption at rest; key rotation runbook; access logs.
- [ ] Data-residency matrix documented (EU/EEA, OHADA options, Rwanda public sector).

F. UI/UX Accessibility & Readiness

- [ ] Research 3-pane, Drafting (redline), Matters (deadlines), Citations browser (version diff), HITL Review, Corpus Manager, Admin—all responsive & WCAG 2.2 AA.
- [ ] Jurisdiction Router chips (+ OHADA/EU flags); Maghreb banner; Rwanda sources.
- [x] Export (PDF/DOCX) with bibliography and C2PA proof.

G. Quality, Evals, and Telemetry

- [ ] LegalBench/LexGLUE CI green; golden-set evals per jurisdiction.
- [ ] Metrics thresholds met: ≥95% allowlisted citation precision; ≥95% temporal validity; 100% Maghreb warnings when applicable; ≥98% HITL recall on high-risk sets.
- [ ] OpenAI Platform eval job (via `pnpm ops:evaluate`) completed for mapped datasets; results persisted to `agent_learning_jobs` and dashboards reflect pass/fail before launch.
- [ ] Observability dashboards (citations accuracy, retrieval recall, HITL latency) live.

H. Operations

- [ ] CI `Deploy` : le préflight `scripts/deployment-preflight.mjs` passe avec les secrets de production (validation Supabase/OpenAI + `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm build`).
- [ ] Cron: crawlers, backfills, nightly evals; quarantine flow working.
- [ ] Incident response & rollback; model/policy versioning; change log.
- [ ] SLO snapshots captured (`slo_snapshots`) and regulator dispatches logged (`regulator_dispatches`) for the launch window.

Decision: ☐ GO ☐ NO-GO — Owner/Date: _______

> **Suivi automatisé :** utilisez `pnpm ops:go-no-go --org <ORG> [--release <TAG>] --require-go` pour lister les preuves saisies
> dans `go_no_go_evidence`, vérifier les sections manquantes et confirmer qu'une décision « GO » a bien été enregistrée avant de
> déclencher la mise en production.

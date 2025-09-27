# Risk Register

| Risk | Impact | Likelihood | Mitigation | Owner |
| --- | --- | --- | --- | --- |
| Missing Google Drive ingestion | High – authoritative corpus stale, breaches readiness checklist | High | Implement Drive watcher + manifest QA; monitor ingestion_runs for gaps | DataOps |
| Confidential Mode not enforced | High – confidentiality breach if web search hits public sites | Medium | Wire confidential flag through agent, disable web tool, log audits | Backend |
| Absent governance policies | High – go-live blocked by compliance/legal | Medium | Draft TOJI-aligned policy pack and have Legal sign-off | Compliance |
| Evaluation metrics not persisted | Medium – cannot prove 95% precision SLA | Medium | Extend eval CLI to write metrics and surface dashboards | Ops |
| No cron scheduling | Medium – ingestion/learning jobs rely on manual triggers | Medium | Commit Supabase cron config & alerting | DataOps |
| Authority diff missing | Medium – reviewers may miss version conflicts | Medium | Implement diff UI component with highlighting | Frontend |
| Limited security controls UI | Medium – enterprise buyers blocked (IP allowlist/DLP) | Medium | Implement admin toggles + backend enforcement | Security Eng |
| Pilot collateral absent | Medium – GTM slip, revenue delay | High | Produce onboarding kit, pricing, change-management docs | PMO |
| Dependency on stubbed tests for eval | Low – false sense of coverage | Medium | Add integration tests hitting real agent with allowlist guardrails | QA |

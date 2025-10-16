# Go / No-Go Checklist — Agent-First Shell Cutover

This document tracks operational readiness for enabling the `FEAT_AGENT_SHELL` feature flag by default and promoting the agent-first workspace experience to production.

## Preconditions
- [ ] Database migrations applied in staging and production with snapshots captured.
- [ ] Supabase RLS policies validated for all new tables (`agent_runs`, `tool_invocations`, `run_citations`, etc.).
- [ ] Vector store ingestion smoke-tested with Drive fixtures and observed in monitoring dashboards.
- [ ] Voice realtime token exchange verified end-to-end with ephemeral keys.
- [ ] PWA install prompt, offline outbox, and staleness chip verified on mobile and desktop.
- [ ] Web Vitals (LCP, INP, CLS) measured within target thresholds on reference Android hardware.

## Verification Steps
1. Deploy canary with `FEAT_AGENT_SHELL=enabled` for internal tenant.
2. Execute workspace hero prompt (text + voice) and confirm IRAC streaming + citations.
3. Trigger Drafting Studio redline diff generation and export flow.
4. Submit procedural navigator request (hearing) and verify ICS export + deadline wizard.
5. Upload Drive manifest sample, observe ingestion job completion, and confirm citations appear in Evidence Pane.
6. Run nightly eval dry-run and confirm policy gate metrics remain above thresholds.

## Rollback Plan
- Toggle `FEAT_AGENT_SHELL` back to `disabled` in environment config.
- Revert to previous deployment artifact via CI/CD pipeline.
- Restore latest database snapshot if migrations introduce regressions (migrations are additive-only).
- Notify stakeholders via #launch channel and file incident retro if rollback executed.

## Sign-off Matrix
| Role | Responsibility | Status | Owner |
| ---- | -------------- | ------ | ----- |
| Product | Accepts UX regressions risk |  | |
| Engineering | Confirms infra + feature flag posture |  | |
| QA | Executes manual checklist |  | |
| Legal Ops | Approves policy guardrail updates |  | |
| Support | Updates runbooks + macros |  | |

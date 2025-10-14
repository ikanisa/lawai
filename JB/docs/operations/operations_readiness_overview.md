# Operations Readiness Overview

This overview establishes the operational readiness baseline for Avocat-AI Francophone. It consolidates pre-launch obligations, day-0/1 runbooks, and continuous assurance workflows that operations, support, and engineering teams must satisfy before shipping to regulated clients.

## 1. Pre-Launch Checklist

1. **Infrastructure baselines**
   - Apply all Supabase migrations (`pnpm db:migrate`) and confirm storage buckets (`authorities`, `uploads`, `snapshots`) plus Postgres extensions (`pgvector`, `pg_trgm`).
   - Run `pnpm ops:check` to validate environment prerequisites, vector store reachability, and allowlist synchronisation.
   - Ensure incident and regulator dispatch ledgers are migrated (`supabase/migrations/20240101004500_transparency_reports.sql`, `20240101004600_regulator_dispatches.sql`).
2. **Security & access controls**
   - Configure SSO/SCIM, enforce MFA, and validate RBAC/ABAC policies in Supabase and the web console.
   - Seed residency and lawful basis matrices for Maghreb, Rwanda, EU, and OHADA jurisdictions.
   - Verify confidential mode policies and audit log retention windows in `apps/api/src/server.ts` governance endpoints.
3. **Compliance scaffolding**
   - Publish CEPEJ charter mapping, EU AI Act FRIA template, and Council of Europe alignment note in the Trust Center.
   - Run red-team (`pnpm ops:red-team`) and evaluation campaigns (`pnpm ops:evaluate`) capturing evidence in Supabase.
   - Execute the Go / No-Go checklist and secure sign-off from the Responsible AI committee.

## 2. Day-0 Launch Activities

- **Cutover rehearsal** – Perform a dry run of ingestion pipelines, agent orchestrator, and HITL queue in staging with monitoring dashboards enabled.
- **Support onboarding** – Train support staff on CEPEJ/EU AI Act escalation ladder, ticket triage, and Trust Center update flows.
- **Communications readiness** – Draft initial Trust Center bulletin, status page incident templates, and regulator contact scripts.
- **Monitoring verification** – Confirm `/metrics/governance`, `/metrics/cepej`, `/metrics/slo`, and `/reports/dispatches` endpoints return data aligned with Supabase records.

## 3. Day-1 Steady State

| Function | Daily | Weekly | Monthly |
| --- | --- | --- | --- |
| Operations | Review SLO dashboard, CEPEJ alerts, and HITL backlog. Ensure remediation tickets tracked in ops system. | Publish CEPEJ metrics export to compliance. | Refresh performance snapshot (`pnpm ops:perf-snapshot`) and archive in Trust Center. |
| Support | Validate incident queue, ensure SLA coverage, and update Trust Center if incidents occur. | Run spot checks on residency banners and Maghreb/Rwanda localisation. | Participate in post-incident drills and update playbooks. |
| Engineering | Inspect error budgets, retrier logs, and vector store health. | Rotate credentials, review red-team backlog, schedule dependency updates. | Execute disaster recovery drill and publish results. |

## 4. Readiness Evidence Repository

All readiness evidence must be centralised to support audits and regulator inquiries:

- **Supabase** – `transparency_reports`, `slo_snapshots`, `performance_snapshots`, `red_team_findings`, `eval_results`, `governance_publications`, `regulator_dispatches`.
- **Docs** – Disaster recovery runbook, red-team playbook, CEPEJ charter mapping, FRIA template, data residency matrix, pricing collateral.
- **Dashboards** – Operator console compliance overview, trust-tiered corpus health, residency coverage, HITL queue metrics.

## 5. Continuous Improvement Loop

1. Capture feedback from operators and clients weekly, linking issues to remediation tickets and tracking closure time.
2. Feed lessons learned into the red-team backlog, evaluation cases, and agent learning pipelines (`apps/edge/process-learning`).
3. Update Trust Center resources and readiness documentation whenever controls change or new jurisdictions go live.
4. Schedule quarterly readiness retrospectives with Compliance, Engineering, Support, and Leadership to review incident trends, CEPEJ/EU AI Act metrics, and SLO performance.

Maintaining this readiness posture ensures Avocat-AI Francophone can evidence operational excellence, compliance maturity, and regulator-grade resilience at any time.

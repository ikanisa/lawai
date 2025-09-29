# Observability Report

## Logs
- Fastify logger enabled with structured errors (`apps/api/src/server.ts:20-27`).
- Audit events recorded via `logAuditEvent` for SSO/SCIM changes (`apps/api/src/sso.ts:70-118`, `apps/api/src/scim.ts`).
- Missing: application log shipping guidance (no log drain configuration documented).

## Metrics
- Governance endpoints expose retrieval, evaluation, CEPEJ, SLO snapshots (`apps/api/src/server.ts:712-905`, `1085-2184`).
- Supabase views `org_retrieval_metrics`, `org_evaluation_metrics` aggregate data (`db/migrations/0067_retrieval_metrics_views.sql`, `0071_org_evaluation_metrics.sql`).
- Gaps: No automated alerting on threshold breach; evaluation CLI ignores metrics failures (`apps/ops/src/evaluate.ts:400-520`).

## Traces
- No distributed tracing or request correlation IDs present.

## Dashboards / Alerting
- Governance dashboard in frontend consumes metrics but Rwanda coverage missing (`apps/web/src/components/admin/admin-view.tsx`).
- No documented Grafana/DataDog dashboards or alert rules for ingestion failures, vector store lag, or Web Vitals.

## Action Items
1. Add alerting (Slack/PagerDuty) for ingestion failures, evaluation regressions, SLO breaches.
2. Implement OpenTelemetry/OTLP exporter in API for request tracing.
3. Extend admin dashboard to surface Rwanda and Maghreb banner compliance plus vector store backlog.

# Security & Privacy Report

## Row-Level Security & Access Controls
- Supabase RLS enabled on tenant tables and helper `public.is_org_member(p_org)` defined (`db/migrations/0002_auth_orgs.sql:22-33`, `db/migrations/0005_rls.sql:1-44`).
- Access middleware enforces RBAC/ABAC, MFA/passkey headers, consent + IP allow-list checks (`apps/api/src/access-control.ts:180-357`).

## Secrets & Environment Hygiene
- `.env.example` now ships with placeholders; gitleaks step added to CI (`.github/workflows/ci.yml:17-23`).
- ❗ Provider-side rotation still required for the previously exposed OpenAI/Supabase keys (action item tracked in Outstanding Items).

## Identity (SSO/SCIM/MFA)
- SSO connections with group→role mapping implemented (`apps/api/src/sso.ts:1-220`).
- SCIM provisioning endpoints and token management present (`apps/api/src/scim.ts:1-305`).
- MFA/passkey policy respected via `X-Auth-Strength` header gate (`apps/api/src/access-control.ts:328-333`).

## Confidential Mode & Data Minimisation
- Confidential prompts remain in-memory only and UI now blurs response panes (`apps/web/src/hooks/use-outbox.ts:34-60`, `apps/web/src/components/research/research-view.tsx:140-460`).
- Telemetry is suppressed when confidential mode is active; web search already disabled via agent configuration (`apps/api/src/agent.ts:3935-3949`).

## Data Residency & Retention
- Residency enforcement functions guard storage prefixes and residency zones (`db/migrations/0053_storage_residency_enforcement.sql`).
- Residency matrix documented (`docs/governance/data_residency_matrix.md`).

## DPIA / FRIA / EU AI Act
- Compliance assessment pipeline raises FRIA tickets and CEPEJ violations (`apps/api/src/compliance.ts:1-94`, `apps/api/src/agent.ts:1883-1958`).
- Rwanda corpus + UI triage shipped (allowlist and banner), enabling coverage across mandated jurisdictions.

## CEPEJ & France Policy Checks
- France judge analytics guard produces HITL-only response (`apps/api/src/agent.ts:4043-4125`).
- CEPEJ metrics views exist (`db/migrations/0046_cepej_metrics_view.sql`), surfaced through `/metrics/cepej` (`apps/api/src/server.ts:826-868`).

## Outstanding Risks
1. Secrets leak (BLOCKER) – rotate OpenAI/Supabase keys at provider level despite repo sanitisation.
2. Vector store ingestion lacks READY polling (HIGH) – implement poll/backoff before marking documents synced.
3. Evaluation/CI thresholds still unenforced (HIGH) – add gating to `ops:evaluate`.

# Security Architecture Overview

This document summarizes the current security controls across Avocat AI services, the threat models they address, and the implementation evidence that demonstrates enforcement. Use it alongside the root-level `SECURITY.md` policy for operational procedures and reporting workflows.

## Automated Scanning Coverage

| Control | Threat Model | Implementation Evidence |
| --- | --- | --- |
| Dependency vulnerability scanning | Prevent known-vulnerable OSS packages from entering production | `.github/workflows/dependency-audit.yml` runs `pnpm audit`, `npm audit`, and OSV scanning on pushes, PRs, and a weekly schedule. |
| Secret scanning | Detect credential leakage before release | `.github/workflows/secret-scan.yml` executes Gitleaks with artifact archival for downstream analysis. |
| SBOM generation | Maintain inventory of shipped dependencies | `.github/workflows/dependency-audit.yml` publishes a dependency tree artifact each run. |

## Platform Security Controls

| Area | Primary Threats | Evidence |
| --- | --- | --- |
| API boundary | XSS-driven cookie theft, CSRF session riding, downgrade of TLS protections | `apps/api/src/security/policies.ts` attaches Helmet-based HSTS/CSP headers and enforces double-submit CSRF tokens. `apps/api/src/routes/security/index.ts` exposes a `/security/csrf` endpoint for token issuance, registered in `apps/api/src/app.ts`. |
| Browser clients | Mixed-content injection, credential exfiltration | `apps/web/next.config.mjs` and `apps/pwa/next.config.mjs` ship aligned CSP/HSTS headers. Client fetch helpers (`apps/web/src/lib/api.ts`, `apps/pwa/lib/apiClient.ts`) default to `credentials: 'include'` and automatically attach CSRF tokens via `apps/web/src/lib/security.ts` / `apps/pwa/lib/security.ts`. |
| Operations automation | Excessive data retention, stale personal data | `apps/ops/src/gdpr-retention.ts` implements the GDPR deletion job. The scheduler integration in `apps/ops/src/lib/scheduler.ts` and CLI wiring in `apps/ops/src/lib/cli.ts` expose cron-friendly entry points, with the `apps/ops/package.json` script `gdpr:retention` enabling CI/CD scheduling. |
| Shared tooling | Drift between ops scripts and infra | `packages/shared/src/scheduling/scheduler.ts` exports `scheduleGdprRetention` to keep scheduler orchestrations consistent. |

## Residual Risks & Mitigations

| Risk | Context | Mitigation / Owner |
| --- | --- | --- |
| Inline script allowances (`'unsafe-inline'`, `'unsafe-eval'`) remain in CSP for Next.js hydration | Needed for current SSR tooling; increases XSS blast radius | Track migration to nonce-based CSP in frontend backlog. Monitor for script regressions during releases. |
| CSRF token is readable by client-side code | Enables SPA telemetry and fetch helpers, but token could leak if XSS occurs | Prioritize XSS prevention (lint rules, trusted types backlog). Incident playbook includes CSRF secret rotation. |
| Retention job coverage excludes external storage artefacts | Current automation deletes database records only | Extend `apps/ops/src/gdpr-retention.ts` to orchestrate storage bucket cleanup. Audit infra state quarterly. |
| Legacy lint errors in `apps/api` and `apps/web` hinder automated quality gates | Existing codebase debt complicates CI enforcement | Track follow-up issue to migrate to flat ESLint config and resolve `no-explicit-any`/unused symbol violations before tightening lint CI. |

## Logging & Observability

- `apps/ops/src/gdpr-retention.ts` emits OpenTelemetry spans with status codes for each dataset cleanup.
- The CLI entry point calls `initNodeTelemetry` to connect traces to the shared observability stack (see `@avocat-ai/observability`).
- Deletion summaries include scope, cutoff timestamp, and count, enabling dashboards to highlight deletion volume over time.

## Next Steps

1. Automate regression tests that exercise CSRF-protected endpoints in both the web app and telemetry reporters.
2. Add smoke tests (or manual checklists) to verify tightened CSP/HSTS headers do not block required assets in staging.
3. Expand retention coverage to include file/object storage artefacts once inventory is complete.


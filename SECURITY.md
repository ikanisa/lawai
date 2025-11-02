# Security Policy

## Reporting Security Vulnerabilities

**Please do not report security vulnerabilities through public GitHub issues.**

If you discover a security vulnerability in the Avocat-AI Francophone system, please report it to us through one of the following channels:

- **Email**: security@avocat-ai.example (replace with actual security contact)
- **GitHub Security Advisory**: Use the "Report a vulnerability" feature in the Security tab

Please include the following information in your report:

- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- The location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Response Timeline

We aim to respond to security reports within:

- **Initial response**: 48 hours
- **Preliminary assessment**: 5 business days
- **Confirmed vulnerability fix**: Based on severity (Critical: 7 days, High: 14 days, Medium: 30 days)

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |
| work    | :white_check_mark: |

## Security Measures

### Authentication & Authorization

- **Multi-tenant access control**: Organization-level isolation using Supabase RLS policies
- **Role-based permissions**: Owner, Admin, Member, Reviewer, Viewer, Compliance Officer, Auditor roles
- **IP allowlisting**: Optional IP allowlist enforcement per organization
- **MFA requirement**: Configurable MFA enforcement via organization policies
- **Session management**: Device session tracking with revocation capabilities
- **SSO/SCIM integration**: Enterprise single sign-on and user provisioning support

### Data Protection

- **Encryption at rest**: Database and storage bucket encryption via Supabase
- **Encryption in transit**: TLS 1.2+ for all external communications
- **Secrets management**: Environment variables for secrets, placeholder validation in production
- **PII handling**: Audit logging for sensitive operations, residency zone enforcement
- **Data retention**: Configurable retention policies per organization with automated enforcement via `apps/ops/src/gdpr-retention.ts` scheduled in `apps/ops/src/lib/scheduler.ts`
- **Audit trail**: Comprehensive audit event logging in `audit_events` table

### API Security

- **Rate limiting**: Configurable per-endpoint rate limits with Redis or in-memory backend
- **Input validation**: Zod schema validation for all API inputs
- **CORS policies**: Restricted CORS configuration (see `apps/api/src/app.ts`)
- **Request authentication**: X-Org-Id and X-User-Id headers with authorization guards
- **Content Security Policy & HSTS**: Uniform headers enforced in the API (`apps/api/src/security/policies.ts`) and front-end deployments (`apps/web/next.config.mjs`, `apps/pwa/next.config.mjs`)
- **CSRF mitigation**: Double-submit cookie and token enforcement for browser-originated requests with a dedicated token endpoint (`apps/api/src/routes/security/index.ts`, `apps/web/src/lib/security.ts`, `apps/pwa/lib/security.ts`)

### Database Security

- **Row-Level Security (RLS)**: Comprehensive RLS policies on all multi-tenant tables
- **Prepared statements**: Supabase client uses parameterized queries
- **Connection pooling**: Configured in Supabase and pg clients
- **Migration safety**: Forward-only migrations with rollback strategies documented
- **Least privilege**: Service role keys used only where necessary

### Infrastructure Security

- **Container hardening**: (In progress) Non-root user, minimal base images
- **Dependency scanning**: Automated pnpm/npm audit workflow (`.github/workflows/dependency-audit.yml`)
- **Secret scanning**: TruffleHog plus Gitleaks coverage in CI (`.github/workflows/secret-scan.yml`)
- **SBOM generation**: Software Bill of Materials for transparency
- **Network security**: Edge functions with service secret authentication

### Monitoring & Incident Response

- **Structured logging**: JSON logs with correlation IDs for tracing
- **Security event monitoring**: Failed authentication, authorization violations logged
- **Alerting**: Slack/email webhooks for critical security events
- **Incident playbook**: See `docs/governance/incident-response.md` (if exists)

## Security Best Practices for Contributors

When contributing to this project:

1. **Never commit secrets** - Use `.env.local` for local development, never `.env`
2. **Validate all inputs** - Use Zod schemas for API request validation
3. **Follow least privilege** - Request minimum necessary permissions
4. **Sanitize outputs** - Prevent XSS by properly encoding user-generated content
5. **Use prepared statements** - Always use parameterized queries
6. **Check authorization** - Verify user permissions before accessing resources
7. **Review RLS policies** - Ensure new tables have appropriate RLS policies
8. **Document security assumptions** - Comment security-critical code sections
9. **Run security checks locally** - Use `pnpm check:binaries` and migration checks before PR
10. **Keep dependencies updated** - Review and approve Dependabot PRs promptly

## Compliance & Governance

The Avocat-AI system is designed to comply with:

- **EU AI Act**: High-risk AI system classification with FRIA (Fundamental Rights Impact Assessment)
- **GDPR**: Personal data protection and privacy by design
- **CEPEJ Guidelines**: European ethical charter on the use of AI in judicial systems
- **Council of Europe AI Treaty**: Explicit acknowledgment requirements

See `docs/governance/` for detailed compliance documentation.

## Security Tooling

The following security tools are integrated or recommended:

- **CodeQL**: Static analysis for code vulnerabilities (`.github/workflows/codeql-analysis.yml`)
- **Dependency audits**: Combined pnpm/npm audit pipeline (`.github/workflows/dependency-audit.yml`)
- **Secret scanning**: TruffleHog plus Gitleaks coverage in CI (`.github/workflows/secret-scan.yml`)
- **Supabase RLS**: Row-level security for multi-tenant isolation (configured)
- **Red Team Testing**: Automated adversarial testing via `pnpm ops:red-team`
- **Evaluation Framework**: Continuous testing of safety guardrails

### Threat Modeling & Residual Risks

- **Browser CSP allowances**: The enforced CSP still permits `'unsafe-inline'` (scripts/styles) and `'unsafe-eval'` during development to support Next.js hydration and tooling (`apps/web/next.config.mjs`, `apps/pwa/next.config.mjs`). Mitigation: continue migrating components toward nonce-based script injection and monitor for inline script regressions.
- **CSRF token exposure to XSS**: The double-submit approach intentionally leaves the CSRF token readable by client-side code to satisfy SPA fetch requirements (`apps/api/src/security/policies.ts`). Residual risk is limited to scenarios where an attacker already achieved XSS; ongoing hardening should focus on reducing XSS sources.
- **Retention policy coverage**: Automated deletions currently target chat transcripts, agent runs, audit, and consent events (`apps/ops/src/gdpr-retention.ts`). Additional datasets (e.g., external storage artefacts) remain in scope for future phases and must be catalogued in follow-up threat reviews.

## Contact

For general security questions or concerns:
- **Security team**: security@avocat-ai.example (replace with actual contact)
- **CODEOWNERS**: See `.github/CODEOWNERS` for team contacts

---

**Last Updated**: 2025-10-29
**Policy Version**: 1.0

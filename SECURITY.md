# Security Policy

## Reporting Security Vulnerabilities

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities via one of the following methods:

1. **Email**: Send details to [security@avocat-ai.com] (if applicable)
2. **GitHub Security Advisories**: Use the "Security" tab in this repository
3. **Private Disclosure**: Contact the Platform Squad Lead directly via secure channel

### What to Include

When reporting a security vulnerability, please include:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** of the vulnerability
- **Affected versions** (if known)
- **Suggested fix** (if you have one)
- **Your contact information** for follow-up

### Response Timeline

- **Acknowledgment**: Within 24 hours of report
- **Initial Assessment**: Within 72 hours
- **Regular Updates**: Every 7 days until resolved
- **Resolution Target**: 
  - Critical vulnerabilities: 7 days
  - High vulnerabilities: 14 days
  - Medium vulnerabilities: 30 days
  - Low vulnerabilities: 90 days

## Supported Versions

We support the following versions with security updates:

| Version | Supported          | Notes |
| ------- | ------------------ | ----- |
| main    | :white_check_mark: | Latest development version |
| Latest Release | :white_check_mark: | Current production release |
| Previous Release | :white_check_mark: | Supported for 30 days after new release |
| Older Releases | :x: | No security updates provided |

## Security Measures

### Authentication & Authorization

- **Supabase Auth**: JWT-based authentication with secure token handling
- **Row-Level Security (RLS)**: Postgres RLS policies enforced at database level
- **RBAC**: Role-based access control for API endpoints and UI features
- **Session Management**: Secure session handling with automatic expiration

### Data Protection

- **Encryption in Transit**: TLS 1.3 for all connections
- **Encryption at Rest**: Database and storage encrypted at rest
- **Secrets Management**: 
  - Never commit secrets to repository
  - Use environment variables for all sensitive data
  - Production rejects placeholder secrets (`sk-test-`, `localhost`, etc.)
  - Rotate secrets regularly using `pnpm ops:rotate-secrets`
- **PII Handling**: 
  - Minimal PII collection
  - PII scrubbed from logs
  - GDPR-compliant data retention policies

### Input Validation

- **Schema Validation**: Zod schemas at all API boundaries
- **SQL Injection Prevention**: Parameterized queries via Supabase client
- **XSS Prevention**: Content Security Policy (CSP) headers, sanitized outputs
- **CSRF Protection**: Token-based CSRF protection for state-changing operations

### Security Headers

All web applications enforce the following security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: [See application-specific policies]
```

### Rate Limiting

- **API Rate Limits**: Applied per feature bucket and user
- **Authentication Rate Limits**: Prevent brute-force attacks
- **Upload Rate Limits**: Prevent abuse of file upload endpoints

### Dependency Management

- **Automated Scanning**: Dependabot configured for security updates
- **Manual Review**: Security-critical dependencies reviewed manually
- **SBOM Generation**: Software Bill of Materials generated for each release
- **Vulnerability Scanning**: CodeQL and dependency audits in CI/CD

### Compliance

- **GDPR Compliance**: Data protection and privacy by design
- **French Legal Compliance**: 
  - Judge analytics ban enforcement
  - FRIA/CEPEJ obligations validation
  - Audit trails for all legal operations
- **Data Residency**: Configurable data residency zones for compliance

### Code Security

- **Code Review**: All changes reviewed before merging
- **Static Analysis**: CodeQL scans on every PR
- **Secret Scanning**: Automated secret detection in commits
- **Dependency Audit**: Regular audits of third-party dependencies

## Security Features

### Application-Level Security

#### API (`apps/api`)

- JWT validation on all protected endpoints
- Request logging with correlation IDs
- Rate limiting per user and IP
- Input validation with Zod schemas
- SQL injection prevention via Supabase client
- Error messages sanitized (no stack traces in production)

#### Web Console (`apps/web`)

- Authentication required for all routes
- CSP headers prevent XSS
- Secure cookie configuration
- CSRF tokens for forms
- Sensitive data masked in UI

#### PWA (`apps/pwa`)

- Service worker security policies
- Content served over HTTPS only
- Offline data encrypted in IndexedDB
- Secure credential storage

#### Edge Functions (`apps/edge`)

- Authenticated function invocation
- Rate limiting at edge
- Input validation
- Secure secrets storage in Supabase vault

### Infrastructure Security

- **Non-root Containers**: All containers run as non-root user
- **Minimal Base Images**: Use distroless or Alpine for minimal attack surface
- **Image Scanning**: Container images scanned for vulnerabilities
- **Network Policies**: Least-privilege network access
- **Secrets Rotation**: Regular rotation of API keys and tokens

## Security Guardrails

The system includes built-in security guardrails:

1. **Confidential Mode**: Disables external data sources when enabled
2. **HITL Escalation**: High-risk queries automatically escalated for review
3. **Compliance Checks**: Automatic validation against legal compliance requirements
4. **Audit Logging**: Comprehensive audit trail of all operations
5. **Rate Limiting**: Prevents abuse and DoS attacks

## Incident Response

In case of a security incident:

1. **Containment**: Immediately isolate affected systems
2. **Assessment**: Determine scope and impact of the breach
3. **Notification**: Inform affected users and stakeholders per legal requirements
4. **Remediation**: Apply fixes and patches
5. **Post-Mortem**: Document incident and improve security measures
6. **Regulatory Reporting**: Report to relevant authorities if required by law

See [docs/release-runbook.md](./docs/release-runbook.md) for detailed incident response procedures.

## Security Best Practices for Contributors

### Code Security

- **Never commit secrets**: Use environment variables
- **Validate all inputs**: Use Zod schemas
- **Sanitize outputs**: Prevent XSS
- **Use parameterized queries**: Prevent SQL injection
- **Handle errors gracefully**: Don't leak sensitive information
- **Keep dependencies updated**: Regularly update and audit dependencies

### Authentication & Authorization

- **Always check permissions**: Never trust client-side authorization
- **Use RLS policies**: Enforce security at database level
- **Validate JWTs**: Verify tokens on server side
- **Implement least privilege**: Grant minimum necessary permissions
- **Secure session handling**: Use secure, httpOnly cookies

### Data Handling

- **Minimize PII collection**: Only collect necessary data
- **Encrypt sensitive data**: Both in transit and at rest
- **Scrub logs**: Remove PII and secrets from logs
- **Implement data retention**: Delete data when no longer needed
- **Respect data residency**: Store data in appropriate jurisdictions

### Testing Security

- **Write security tests**: Test authentication, authorization, input validation
- **Test error handling**: Ensure errors don't leak sensitive information
- **Test rate limiting**: Verify rate limits work correctly
- **Run security scans**: Use CodeQL and dependency audits
- **Test in staging**: Always test security features in staging first

## Security Checklist for PRs

Before submitting a PR that touches security-sensitive areas:

- [ ] No secrets committed
- [ ] Input validation added for new endpoints
- [ ] Authorization checks in place
- [ ] Error messages sanitized
- [ ] SQL queries parameterized
- [ ] XSS prevention measures applied
- [ ] Rate limiting configured (if applicable)
- [ ] Audit logging added for sensitive operations
- [ ] Security tests added
- [ ] Documentation updated

## Known Security Considerations

### Current Security Debt

1. **API Deployment Security**: Deployment strategy for API service needs hardening (pending architecture decision)
2. **Edge Function Authentication**: Some edge functions need enhanced authentication (tracked)
3. **SBOM Generation**: SBOM generation workflow to be implemented
4. **Container Scanning**: Container vulnerability scanning to be added to CI/CD

### Mitigations in Place

All known security debt items have compensating controls:

- Manual security reviews for affected areas
- Enhanced monitoring and alerting
- Restricted access to production environments
- Regular security audits

## Security Contacts

- **Security Team**: [TBD - Add contact information]
- **Platform Squad Lead**: [TBD - Add contact information]
- **CTO**: [TBD - Add contact information]

## Resources

- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

## Acknowledgments

We appreciate the security research community and all individuals who responsibly disclose vulnerabilities. 

If you would like to be acknowledged for a security disclosure, please let us know when you report the vulnerability.

---

**Last Updated**: 2025-10-29  
**Version**: 1.0  
**Document Owner**: Platform Squad + Security Team

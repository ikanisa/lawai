# Support

## Getting Help

Thank you for using the Avocat-AI Francophone platform. This document provides guidance on how to get support for issues, questions, or feature requests.

## Support Channels

### 1. Documentation

Before reaching out for support, please check the following resources:

- **README.md**: Project overview, setup instructions, and common workflows
- **CONTRIBUTING.md**: Guidelines for contributing and running local checks
- **docs/** directory: Comprehensive documentation including:
  - `docs/operations/`: Operational runbooks and deployment guides
  - `docs/governance/`: Compliance and governance policies
  - `docs/troubleshooting_network.md`: Network connectivity troubleshooting
  - `docs/env-matrix.md`: Environment variable reference

### 2. GitHub Issues

For bug reports, feature requests, or technical questions:

1. **Search existing issues** to see if your question has been addressed
2. **Use issue templates** when creating new issues (if available)
3. **Provide detailed information**:
   - Steps to reproduce the problem
   - Expected vs. actual behavior
   - Environment details (Node version, OS, deployment platform)
   - Relevant logs or error messages
   - Screenshots for UI issues

**Create an issue**: [https://github.com/ikanisa/lawai/issues/new](https://github.com/ikanisa/lawai/issues/new)

### 3. Pull Request Discussions

For questions about specific code changes or implementation details:

- Comment on relevant pull requests
- Tag appropriate reviewers based on CODEOWNERS
- Follow the PR template checklist

### 4. Team Contacts

For internal team members and contributors:

- **Platform Squad**: `@avocat-ai/platform-squad` (API, Edge, Packages)
- **Frontend Squad**: `@avocat-ai/frontend-squad` (Web console)
- **Ops Team**: `@avocat-ai/ops-team` (Operational tooling, migrations)

See `.github/CODEOWNERS` for specific file ownership.

## Issue Severity Levels

We classify issues using the following severity levels:

### S0 - Critical
- System-wide outages
- Data loss or corruption
- Security vulnerabilities with active exploitation
- Complete service unavailability

**Response time**: Immediate (24/7 on-call)

### S1 - High
- Major feature broken affecting multiple users
- Performance degradation (>50% slower)
- Security vulnerabilities requiring urgent patching
- Data inconsistency affecting operations

**Response time**: 4 business hours

### S2 - Medium
- Feature partially broken or degraded
- Moderate performance issues
- Non-critical bugs affecting specific workflows
- Documentation gaps

**Response time**: 2 business days

### S3 - Low
- Minor bugs with workarounds
- Cosmetic issues
- Enhancement requests
- Documentation improvements

**Response time**: 1 week

## What to Include in Support Requests

To help us resolve your issue quickly, please include:

### For Bugs
- **Description**: Clear summary of the problem
- **Reproduction steps**: Step-by-step instructions
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment**:
  - Node.js version (`node --version`)
  - pnpm version (`pnpm --version`)
  - Operating system and version
  - Deployment platform (local, Vercel, Docker, etc.)
- **Logs**: Relevant error messages or stack traces
- **Configuration**: Environment variables (redact secrets!)

### For Questions
- **Context**: What are you trying to accomplish?
- **What you've tried**: Steps you've already taken
- **Specific question**: Clear and focused query
- **References**: Links to relevant documentation or code

### For Feature Requests
- **Use case**: Problem you're trying to solve
- **Proposed solution**: Your suggested approach
- **Alternatives considered**: Other options you've evaluated
- **Impact**: Who would benefit and how

## Self-Service Troubleshooting

### Installation Issues

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install --no-frozen-lockfile

# Verify versions
node --version  # Should be 20.x
pnpm --version  # Should be 8.15.4
```

### Build Issues

```bash
# Typecheck specific workspace
pnpm --filter @apps/api typecheck

# Lint specific workspace
pnpm --filter @apps/api lint

# Build specific workspace
pnpm --filter @apps/api build
```

### Database Migration Issues

```bash
# Check migration status
ALLOW_SUPABASE_MIGRATIONS=1 pnpm check:migrations

# Run migrations
pnpm db:migrate

# Provision foundation
pnpm ops:foundation
```

### Environment Configuration

```bash
# Validate environment variables
pnpm env:validate

# Check for placeholder values
node scripts/deployment-preflight.mjs
```

### Network Connectivity

See `docs/troubleshooting_network.md` for:
- Restricted runner diagnostics
- Offline mode configuration
- Proxy and firewall troubleshooting

## Known Issues

Current known issues and their workarounds:

1. **Observability typecheck fails** (Expected)
   - Issue: MetricReader version mismatch between OpenTelemetry packages
   - Workaround: Use workspace-specific typecheck or ignore

2. **Compliance linting fails** (Expected)
   - Issue: Missing ESLint configuration
   - Workaround: Skip or add `.eslintrc.cjs` to the package

3. **Edge functions skip checks** (Expected)
   - Issue: Deno not installed in CI environment
   - Workaround: Set `DENO_BIN` environment variable if needed

4. **Lockfile sync issues** (Expected)
   - Issue: Lockfile out of sync with `apps/edge/package.json`
   - Workaround: Use `--no-frozen-lockfile` locally

5. **Cypress download fails** (Expected)
   - Issue: Restricted network in CI
   - Workaround: Use `--ignore-scripts` flag

## Service Level Objectives (SLO)

For production environments, we target:

- **API Availability**: 99.9% uptime
- **API Latency (P95)**: < 2000ms for agent runs
- **HITL Response Time**: < 180s for human-in-the-loop reviews
- **Allowlist Citation Precision**: ≥ 95%
- **Temporal Validity**: ≥ 95%

Monitor SLOs with:
```bash
pnpm ops:slo --org <org-id> --user <user-id> --list
```

## Operational Runbooks

For operational procedures, see:

- **Launch Runbook**: `docs/operations/avocat-ai-launch-runbook.md`
- **Deployment Checklist**: `docs/deployment/vercel.md`
- **Red Team Playbook**: `docs/operations/red_team_playbook.md`
- **Go/No-Go Checklist**: Use `pnpm ops:go-no-go`

## Security Issues

**Do not report security vulnerabilities through public GitHub issues.**

See `SECURITY.md` for responsible disclosure procedures and security contact information.

## Community Guidelines

When seeking or providing support:

- **Be respectful**: Treat everyone with courtesy and professionalism
- **Be patient**: Responses may take time depending on severity and availability
- **Be specific**: Provide clear, actionable information
- **Be collaborative**: Work together to find solutions
- **Follow up**: Close issues when resolved or provide updates

## Commercial Support

For enterprise support, SLA commitments, or consulting services:

- **Contact**: support@avocat-ai.example (replace with actual contact)
- **Enterprise inquiries**: enterprise@avocat-ai.example (replace with actual contact)

## Useful Links

- **GitHub Repository**: https://github.com/ikanisa/lawai
- **Issues**: https://github.com/ikanisa/lawai/issues
- **Pull Requests**: https://github.com/ikanisa/lawai/pulls
- **Releases**: https://github.com/ikanisa/lawai/releases

---

**Last Updated**: 2025-10-29
**Support Policy Version**: 1.0

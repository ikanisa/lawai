# Contributing

This repository supports the Avocat-AI Francophone programme. Please follow the guidelines below so that reviews stay predictable and deployments to legacy hosting platform remain safe.

## Commit messages
- Use the [Conventional Commits](https://www.conventionalcommits.org/) format (`type(scope): summary`). This gives the audit trail that the governance review recommended when establishing CODEOWNERS and PR policy.【F:docs/audit/2025-02-22_repo_baseline.md†L101-L110】
- Keep messages descriptive. Explain the behaviour change and any user-facing impact or follow-up tasks.

## Branch workflow
- Work from feature branches that target `main`. Confirm your `origin` remote and rebase onto the latest `main` before requesting review, mirroring the operational checklist in the PR template.【F:.github/PULL_REQUEST_TEMPLATE.md†L6-L17】
- Resolve merge conflicts locally and ensure your branch stays fast-forwardable. Avoid force-pushing to `main`.

## Required local checks
Run the same gates that CI enforces before opening a PR:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm check:migrations
pnpm check:binaries
```

- Linting, type-checking, migrations, tests, and builds are the required stages in the CI workflow; running them locally keeps reviews fast.【F:.github/workflows/ci.yml†L1-L74】
- `pnpm check:binaries` must succeed. The README outlines this safeguard so that reviewers do not have to reject PRs because of binary artefacts.【F:README.md†L120-L137】

## Pull request checklist
- Populate every box in `.github/PULL_REQUEST_TEMPLATE.md`. Link staging smoke-test evidence and confirm Supabase migrations have been applied where required.【F:.github/PULL_REQUEST_TEMPLATE.md†L1-L23】
- Tag the right reviewers through CODEOWNERS by keeping files scoped to their owners. Include any runbook or Trust Center updates when functionality changes.
- Ensure a legacy hosting platform preview build is healthy before requesting deployment approval.

Following these steps keeps the Platform, Frontend, and Ops squads aligned with the governance expectations documented in `docs/` and prevents surprises during release reviews.

## Code quality and architecture

### Architecture principles

The refactor follows clean architecture with clear layer boundaries:

- **Domain layer** (`packages/shared/domain`) - Pure business logic, no I/O, framework-agnostic
- **Application layer** (`apps/*/src/routes`, `apps/*/src/services`) - HTTP handling, orchestration
- **Infrastructure layer** (`packages/supabase`, external clients) - External integrations

Follow these principles when making changes:
- Keep domain logic pure and testable
- No direct database/API calls from presentation layer
- Use dependency injection for infrastructure dependencies
- Maintain layer boundaries (domain → application → infrastructure)

### Code style

- Use `.editorconfig` settings (2-space indentation, LF line endings, UTF-8)
- Follow existing patterns in the codebase
- Use TypeScript strict mode for new code
- Add types, avoid `any` except when truly necessary
- Keep functions focused and small (<50 lines ideal)
- Add JSDoc comments for public APIs

### Testing requirements

- **Unit tests**: For pure functions and business logic (≥85% coverage target)
- **Integration tests**: For API routes and service interactions (≥70% coverage target)
- **E2E tests**: For critical user journeys (critical paths only)

Before refactoring:
1. Add characterization tests to lock current behavior
2. Run tests to ensure they pass
3. Make changes incrementally
4. Run tests after each change
5. Ensure coverage is maintained or improved

See [docs/test-coverage-baseline.md](./docs/test-coverage-baseline.md) for testing patterns.

### Security practices

- Never commit secrets, tokens, or credentials
- Use environment variables for all configuration
- Validate all inputs with Zod schemas
- Sanitize outputs to prevent XSS
- Use parameterized queries to prevent SQL injection
- Redact PII from logs
- Review [SECURITY.md](./SECURITY.md) before security-sensitive changes

### Performance considerations

- Avoid N+1 queries (use batch operations)
- Add database indexes for frequently queried fields
- Use pagination for large result sets
- Cache expensive computations when appropriate
- Monitor bundle sizes (stay within budgets)
- Profile before optimizing

### Dependency management

- Check [docs/dependency-audit.md](./docs/dependency-audit.md) before adding dependencies
- Use exact versions for tools, caret ranges (^) for libraries
- Run security audits: `pnpm audit`
- Update dependencies via Dependabot PRs
- Test thoroughly after major version updates

### Observability

- Use structured logging (JSON format)
- Include correlation IDs in logs
- Add metrics for business operations
- Use appropriate log levels (error, warn, info, debug)
- Never log sensitive data (passwords, tokens, PII)

See [docs/observability.md](./docs/observability.md) for patterns.

## Documentation

Update documentation when making changes:

- **Architecture changes**: Update [docs/architecture.md](./docs/architecture.md)
- **API changes**: Update endpoint documentation
- **Deployment changes**: Update [docs/release-runbook.md](./docs/release-runbook.md)
- **Breaking changes**: Document migration steps in PR description
- **New features**: Add to README.md

## Issue and PR templates

Use the provided templates for consistency:

- **Bug reports**: [.github/ISSUE_TEMPLATE/bug_report.yml](./.github/ISSUE_TEMPLATE/bug_report.yml)
- **Feature requests**: [.github/ISSUE_TEMPLATE/feature_request.yml](./.github/ISSUE_TEMPLATE/feature_request.yml)
- **Refactor tasks**: [.github/ISSUE_TEMPLATE/refactor_task.yml](./.github/ISSUE_TEMPLATE/refactor_task.yml)

## Release process

See [docs/release-runbook.md](./docs/release-runbook.md) for complete release procedures including:

- Pre-release checklist
- Build and deployment steps
- Smoke testing
- Rollback procedures
- Post-deployment monitoring

## Getting help

- **General questions**: See [SUPPORT.md](./SUPPORT.md)
- **Security issues**: See [SECURITY.md](./SECURITY.md)
- **Architecture discussions**: Check [docs/architecture.md](./docs/architecture.md)
- **Team channels**: Slack #platform-squad, #frontend-squad, #ops-team

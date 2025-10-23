# Contributing

This repository supports the Avocat-AI Francophone programme. Please follow the guidelines below so that reviews stay predictable and deployments to Vercel remain safe.

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
- Ensure a Vercel preview build is healthy before requesting deployment approval.

Following these steps keeps the Platform, Frontend, and Ops squads aligned with the governance expectations documented in `docs/` and prevents surprises during release reviews.

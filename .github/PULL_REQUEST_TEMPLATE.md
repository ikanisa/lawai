> ℹ️  Review the expectations in [`CONTRIBUTING.md`](../CONTRIBUTING.md) before filing your PR.

## Summary
- [ ] Linked issue or ticket: <!-- e.g., Closes #123 -->
- [ ] Describe the change and the user impact.

## Operational Readiness Checklist
- [ ] Mainline branch confirmed (`git remote show origin`) and feature branch rebased onto `main` after latest refactors.
- [ ] Run full workspace CI locally (`pnpm run ci`) and attach logs if failures were resolved.
- [ ] Applied Supabase migrations to staging (`pnpm db:migrate:staging`).
- [ ] Completed staging smoke tests; documented evidence linked here: <!-- add link -->
- [ ] Vercel preview deployment validated and QA reviewer added the `qa-signoff` label.
- [ ] Ops runbooks, Trust Center docs, and release notes updated where applicable.

## Additional Notes
- [ ] Production release tagging plan prepared (`git tag -a vX.Y.Z`).
- [ ] Obsolete branches identified for archival post-merge.

<!-- Please keep this template intact to satisfy compliance and deployment controls. -->

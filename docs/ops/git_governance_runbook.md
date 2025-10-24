# Git Governance and Release Runbook

This runbook defines the branching, review, and deployment governance that keeps the Avocat-AI Francophone codebase in a known-good state while coordinating with compliance and operations stakeholders.

## 1. Maintain an Accurate Mainline

1. Identify the canonical mainline branch (currently `work`). Use `git remote show origin` to confirm the default branch before each refactor phase and detect any drift.
2. If a local branch is missing, recreate it from the remote: `git fetch origin work && git checkout -B work origin/work`. Mirror other protected branches (for example, release or hotfix branches) with `git fetch origin <name> && git checkout -B <name> origin/<name>` so that local automation continues to track remote history.
3. After large refactors land, every feature branch **must** rebase on top of `work` before opening or updating a pull request. Use `git pull --rebase origin work` from the feature branch and resolve conflicts locally prior to pushing. Repeat the rebase before requesting review if the refactor phase is still active.

## 2. Branch Protection and Required Checks

Apply GitHub branch protection to `work` with the following rules:

- Require pull requests before merging (no direct pushes).
- Enforce the status checks exported by GitHub Actions:
  - `Monorepo CI / Full Workspace CI`
  - `Supabase Migration Smoke / Supabase Migration Smoke`
  - `Staging Smoke Tests / Staging Smoke Tests`
  - `legacy hosting platform Preview Build / Auto-create Preview`
  - `QA Sign-off / Require qa-signoff label`
- Require approvals from code owners and QA (see Section 3).
- Dismiss stale reviews on new commits and lock the branch to administrators only for emergency fixes.

Update repository settings so that the new pull request template (see below) is the default for every change.

## 3. legacy hosting platform Preview + QA Sign-off Flow

1. The `legacy hosting platform Preview Build` workflow automatically provisions a preview via the legacy hosting platform Git integration, publishes the deployment URL, and uploads build logs for inspection.
2. QA must validate the preview deployment URL and smoke-test critical user journeys. Once validation passes, QA adds the `qa-signoff` label to the pull request.
3. The `QA Sign-off` status check fails until the label is present, preventing merges without documented QA review.

## 4. Phase Completion Protocol

At the conclusion of every development phase (refactor, feature sprint, regression hardening):

1. Run `pnpm run ci` (or the monorepo CI composite workflow) locally to ensure parity with GitHub Actions.
2. Apply pending Supabase migrations against the staging environment: `pnpm db:migrate:staging` (exports the migrations via the Ops workspace runner).
3. Execute the smoke-test suite against the staging deployment (`pnpm test:smoke`) and capture evidence in the QA drive.
4. Attach artifacts and logs to the pull request prior to requesting QA sign-off.

## 5. Post-Merge Release Discipline

1. After merging to `work`, tag the release with `git tag -a vX.Y.Z -m "Release notes"` and push tags to origin.
2. Trigger the production deployment pipeline (GitHub `deploy.yml` or legacy hosting platform production promotion) and monitor until completion.
3. Archive closed feature branches: `git push origin :feature/old-branch` and delete the local copy to keep the namespace clean.
4. Update the Trust Center release ledger and notify operations once production deployment is green.

Adhering to this runbook ensures that every release is auditable, legacy hosting platform previews are validated, and operational stakeholders receive timely updates.

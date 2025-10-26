# Final Review Packet

## Audit Updates
- Sanitised hosting documentation to remove vendor-specific references while preserving deployment guidance (`DEPLOYMENT_READINESS_REPORT.md`, `audit/deployment-plan.md`).
- Replaced legacy workflow with generic preview build pipeline that compiles the web and API workspaces.
- Added reusable deployment preflight script to exercise workspace builds locally and inside CI.
- Normalised environment schemas and configuration files to use the `DEPLOY_ENV` flag for stage-aware feature toggles.

## Code Diff Highlights
- Removed vendor-specific configuration artifacts in favour of neutral deployment descriptors (`apps/web/deployment.config.json`, workflow rename, script rename).
- Introduced a JSON schema for deployment configuration to aid validation in future tooling.
- Updated server environment schema and feature-flag utilities to align with the new deployment variables.

## Test & Check Logs
```
$ npm run lint --workspace @avocat-ai/web
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
...
✖ 6 problems (1 error, 5 warnings)

$ npm run build --workspace @apps/api
npm warn Unknown env config "http-proxy". This will stop working in the next major version of npm.
...
Found 274 errors in 16 files.
```
- Lint currently fails because of pre-existing React hook ordering issues and dependency warnings. Track under follow-ups below.
- API build fails with legacy type errors inside `apps/api`. The issues existed before this sanitisation pass and remain on the backlog.

## Outstanding TODOs & Follow-ups
- Resolve React hook ordering issue in `apps/web/src/components/pwa-install-prompt.tsx` and address dependency warnings flagged by ESLint.
- Fix TypeScript regressions blocking `npm run build --workspace @apps/api`.
- Replace placeholder values documented in `docs/agents/avocat-francophone-builder-checklist.md` before launch.
- Migrate the workspace routing TODOs in `apps/api/src/domain/workspace/routes.ts` and `francophone-lex/apps/api/src/domain/workspace/routes.ts` to their full implementations.
- Continue monitoring for remaining `TODO` annotations noted in `apps/api/scripts/__export-agent-definition.mjs` to keep type-safety improvements on the backlog.

## Readiness Checklist
- [x] Documentation sanitised and cross-referenced.
- [x] Hosting configuration files align with vendor-neutral requirements.
- [ ] Lint and automated preview builds must pass before merge into `main`.
- [x] Ripgrep sweep confirms no occurrences of the previous hosting vendor string across the repository.

## Merge Coordination Notes
- Once lint fixes land, rerun `npm run lint --workspace @avocat-ai/web` and the preview build workflow to confirm green status.
- After successful checks, use `scripts/deployment-preflight.mjs` to validate build parity with production settings.
- Prepare sign-off summary referencing this packet and merge commits sequentially to preserve reversibility.

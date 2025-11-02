# System overview

## Workspace summary
| Area | Description | Key technologies |
| --- | --- | --- |
| `apps/api` | Fastify-based API providing legal agent orchestration, Redis caching, and Supabase integration. | TypeScript, Fastify, Pino, OpenAI SDK, Redis, Zod |
| `apps/web` | Primary Next.js web front-end serving legal workflows and agent UI. | Next.js 14.2, React 18.3, TanStack Query 5, TailwindCSS, Radix UI |
| `apps/pwa` | Experimental Next.js PWA used for rapid prototyping of Staff tooling. | Next.js 16 beta, React 19 RC, TanStack Query, TailwindCSS, Radix UI, Vitest, Cypress |
| `apps/edge` | Workers runtime utilities (durable object / edge worker scripts). | TypeScript, Cloudflare Workers API (needs deeper inspection) |
| `apps/ops` | Operational command suite for provisioning, compliance, and evaluation tasks. | TypeScript, pnpm scripts, Supabase CLI |
| `packages/*` | Shared packages consumed across apps (`api-clients`, `compliance`, `config`, `observability`, `shared`, `supabase`, `ui-plan-drawer`). | TypeScript, local build scripts |
| `db/*` | Database migrations, seeds, and SQL linting scripts. | Supabase CLI, SQL, TypeScript |
| `infra/`, `ops/`, `docs/` | Infrastructure manifests, operational playbooks, and extensive documentation. | Terraform/Helm manifests, markdown |

## Tooling snapshot
- **Node & package manager:** Node.js `>=20 <21`; pnpm `8.15.4` enforced via `preinstall` check script.
- **TypeScript:** Root TypeScript `5.4.5`; duplicated per workspace with matching versions (confirm consolidation in step 03).
- **Linting & formatting:** eslint invoked per workspace; SQL linting via `scripts/lint-sql.mjs`; no centralised `configs/` directory yet.
- **Testing frameworks:** Vitest for API, web, and PWA packages; Playwright and Cypress present for E2E; Happy DOM/JSdom used for component tests.
- **CI/CD scripts:** Provided through root `pnpm` scripts and `apps/ops` commands; GitHub Actions workflows to be inventoried in step 02.
- **Observability libraries:** `packages/observability` exposes telemetry helpers consumed by API.

## Automation status
- Running `pnpm lint --filter @apps/api` exits with `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL` because the recursive workspace lint forwards `--filter` flags into each eslint invocation. Selective linting requires a script adjustment.
- Type checking, unit tests, and build scripts exist per workspace but have not yet been executed as part of this baseline capture (documented for follow-up in steps 03–04).
- Database migration scripts (`pnpm db:push`, `pnpm db:migrate`) depend on Supabase CLI; ensure availability before automation hardening.

## Gaps against target architecture
1. **Frontend split:** No dedicated Staff/Admin PWA applications yet; `apps/web` currently serves all personas.
2. **Version divergence:** Next.js/React versions differ across `apps/web` and `apps/pwa`, complicating shared UI extraction and strict typing.
3. **Shared configuration:** Absence of centralised `configs/` directory for ESLint, TSConfig, Jest/Vitest, and Cypress.
4. **CI observability:** No aggregated reporting for lint/type/test/build coverage or accessibility budgets.
5. **Agent kernel extraction:** Agent orchestration remains embedded in `apps/api`; a dedicated `packages/agent-kernel` module is not present.
6. **Documentation gaps:** Missing ADR catalogue and up-to-date system overview prior to this addition.

## Next actions (programme alignment)
1. Draft architecture mapping and directory move plan (Step 02) building on this baseline.
2. Create shared tooling configs and enforce strict TypeScript + ESLint (Steps 03–04).
3. Harmonise React/Next versions and carve out Staff/Admin PWAs (Step 07) with shared packages (Step 08).
4. Extract agent kernel into `packages/agent-kernel` with audit and policy gates (Step 06).
5. Expand CI/CD to meet security, observability, and quality gates, including Docker images and Lighthouse CI (Steps 09–11).
6. Finalise documentation, runbooks, and release tagging after quality gates pass (Steps 12–13).

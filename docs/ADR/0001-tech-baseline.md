# ADR 0001 – Baseline technical inventory

- **Status:** Accepted
- **Date:** 2024-12-20
- **Context owner:** Platform Architecture

## Context
The organisation is embarking on a multi-step refactor that restructures the existing Avocat AI codebase into a consolidated monorepo that can power Staff and Admin PWAs, a hardened API, and an autonomous legal agent kernel. Before moving or renaming code, we need a written snapshot of the current state so that upcoming restructuring work (steps 02–13 of the programme plan) can preserve behaviour, tooling, and operational readiness.

## Findings
### Repository layout
The root `package.json` already defines a pnpm workspace that includes `apps/*`, `packages/*`, `db/*`, and `JB/*`. The top-level directories relevant to the refactor are:

- `apps/api` – Fastify-based backend with domain logic, Redis integration, and OpenAI tooling.
- `apps/web` – Next.js 14.2 web front-end with React Query and Tailwind.
- `apps/pwa` – Experimental Next.js PWA with Tailwind, React Query, Radix UI, and Vitest/Cypress harnesses.
- `apps/edge` – Workers runtime utilities (needs deeper analysis in step 02).
- `apps/ops` – Operational scripts, provisioning, and compliance automation.
- `packages/api-clients`, `packages/shared`, `packages/observability`, `packages/supabase`, `packages/ui-plan-drawer`, and `packages/compliance` – Shared packages consumed by the apps and scripts.

Additional top-level folders include `db` (migrations and seed data), `infra` (deployment manifests), `ops` (runbooks, playbooks), and an extensive `docs` tree covering governance, audits, and agent runbooks.

### Tooling and dependencies
- Node.js engine constraint: `>=20 <21` via the root package manifest.
- Package manager: `pnpm@8.15.4` enforced by `preinstall` script.
- TypeScript 5.4.5 at root with secondary versions in apps/pwa (aligned) and apps/web (aligned) but potentially duplicated.
- Next.js versions diverge (`apps/web` on 14.2.5, `apps/pwa` declaring `^16.0.1`), and React versions diverge as well (18.3.1 vs 19.2.0). This mismatch will require harmonisation before consolidation.
- Both front-ends rely on TanStack Query, Tailwind, and Radix UI primitives, providing a foundation for shared UI packages.
- The API depends on Fastify, Pino, OpenAI SDK, Redis, and several internal packages (`@avocat-ai/observability`, `@avocat-ai/shared`, `@avocat-ai/supabase`).

### Quality automation
- Root scripts orchestrate lint, typecheck, test, and build across workspaces.
- Running `pnpm lint --filter @apps/api` fails early because the recursive invocation forwards `--filter` into downstream eslint commands that do not understand the argument. This indicates that the current lint orchestration cannot selectively scope packages without adjustment.
- No consolidated report currently captures test, coverage, or build status; each workspace exposes its own scripts.

### Observed gaps vs target architecture
- Only a single public Next.js app (`apps/web`) exists today; the Staff/Admin split required by the programme is not yet in place.
- Shared packages exist but lack strict typing policies and centralised configuration directories (e.g. `configs/` for linting, tsconfig, jest).
- There is no `docs/SYSTEM_OVERVIEW.md`, ADR catalogue, or dedicated runbooks for the upcoming restructure.
- CI configuration (GitHub Actions) and Dockerfiles exist but need to be audited against the new security and quality gates.

## Decision
Record the current monorepo inventory, stack versions, and automation gaps as the authoritative baseline. Use this document to:

1. Drive the detailed architecture proposal (step 02).
2. Validate that future refactors preserve the enumerated applications, packages, and scripts.
3. Track technical debt items (version divergence, lint orchestration, missing shared configs) that must be resolved as part of the programme.

## Consequences
- Future ADRs and refactor work items can reference this baseline instead of repeating discovery.
- Any deletions or moves of the listed apps/packages must include explicit migration notes and, when possible, `git mv` to retain history.
- Quality automation improvements must account for the current limitation in recursive pnpm filtering to avoid regressing lint coverage.
- This ADR will be revisited after steps 03–04 to confirm that the baseline items have migrated into the new workspace structure without loss of functionality.

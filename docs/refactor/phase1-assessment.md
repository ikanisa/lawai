# Phase 1 – Repository Assessment

_Date: 2025-02-07 • Owner: Codex CLI agent_

## Monorepo Snapshot
- **Workspace tooling**: `pnpm@8.15.4` (declared in `package.json`), Node 20+, TypeScript 5.4 baseline (`tsconfig.base.json`).
- **Top-level scripts**: build/lint/test fan out via `pnpm -r`; additional ops flows under `apps/ops`.
- **CI status**: `.github/workflows` contains at least one untracked workflow (`export-agent.yml`), signalling incomplete automation coverage.
- **Generated artefacts**: `apps/dist` stores exported manifests and should remain build-only output.

## Package Inventory
| Path | Package | Purpose & Stack | Key Scripts | Internal Deps |
| --- | --- | --- | --- | --- |
| `apps/api` | `@apps/api` | Fastify + OpenAI Agents service (TypeScript, Supabase, zod). Houses legal agent runtime, REST API, telemetry, orchestrator. | `dev`, `build`, `lint`, `test`, `export:agent` | `@avocat-ai/shared`, `@avocat-ai/supabase` |
| `apps/web` | `@avocat-ai/web` | Next.js 14 client (Tailwind, TanStack Query, PWA helpers). | `dev`, `build`, `lint`, `typecheck`, `test` | — |
| `apps/pwa` | `@apps/pwa` | Secondary Next.js surface (Radix UI, three.js rich UX). | `dev`, `build`, `lint`, `test`, `cy:e2e`, `bundle:check` | — |
| `apps/ops` | `@apps/ops` | Operational CLIs (vector store tooling, guardrail checks, provisioning). | `dev`, `migrate`, `provision`, `evaluate`, `red-team`, `check`, `phase` | `@avocat-ai/shared`, `@avocat-ai/supabase` |
| `packages/shared` | `@avocat-ai/shared` | Cross-cutting types, IRAC schema, guardrails. | `build`, `lint`, `test` | — |
| `packages/supabase` | `@avocat-ai/supabase` | Supabase client wrapper + domain helpers. | `build`, `lint`, `test` | — |

## Edge & Worker Surfaces
- `apps/edge/*`: 12 Deno edge scripts (e.g., `case-recompute`, `learning-*`, `transparency-digest`) with direct Supabase access. No shared tooling, build, or type-check flow; require dedicated pipeline.
- `apps/api/src/worker.ts` + `apps/ops/src/*`: Node-based workers for learning jobs, compliance, telemetry; rely on manual CLI invocation.

## Data & Infrastructure
- `db/migrations`: Supabase SQL migrations (`0000` – `20251003210000`), mix of schema, RLS, RPC, finance-domain scaffolding.
- `docs/` includes governance/runbooks but lacks central architecture overview; new refactor docs live under `docs/refactor/`.

## Hotspots & Risks (Ranked)
| Severity | Area | Observations / Impact |
| --- | --- | --- |
| **P0** | `apps/api/src/server.ts` (5.3k LOC) & `apps/api/src/agent.ts` (4.4k LOC) | Monolithic modules mixing routing, execution, telemetry, compliance; inhibit testing, code ownership, and feature isolation. |
| **P0** | Test & lint fragmentation | `vitest`/`eslint` wired per-package but no enforced workspace-level gates; drift between packages likely. |
| **P1** | Tooling inconsistencies | Multiple Next.js & TS versions (`apps/web` pins exact, `apps/pwa` ranges); root `pnpm` absent in some environments → build scripts fall back to manual `tsc`. |
| **P1** | Edge scripts lack pipeline | No shared tsconfig, linting, or deploy workflow for `apps/edge`; risk of runtime regressions. |
| **P1** | Large pending/untracked changes | `git status` shows numerous modified/untracked files (finance manifest, orchestrator, workflows) without tests or docs → regressions likely during refactor. |
| **P2** | Shared libraries duplication | Guardrail, telemetry, and connector logic duplicated between `apps/api`, `apps/ops`, and edge scripts; central abstractions missing. |
| **P2** | Config sprawl | `env` loading scattered (`apps/api/src/config.ts`, scripts) with no schema validation or shared loader. |
| **P3** | Documentation gaps | Docs describe legacy plans; no up-to-date architecture diagram or onboarding steps for current stack. |

## Build & Test Workflows
- Back-end: `pnpm --filter @apps/api test` (Vitest, Supabase RPC mocks), `export:agent` exports capability manifest (now resilient to missing `pnpm`).
- Front-end: Next.js builds per app, custom icon/service-worker scripts in `apps/web`; `apps/pwa` adds Cypress e2e but no shared Storybook/docs.
- Ops: CLI scripts executed via `tsx`; no automated scheduling defined in repo.
- Edge: currently manual; no automated typechecking or bundling.

## Phase 1 Output
1. Monorepo inventory (packages, scripts, dependencies) captured above.
2. Hotspot list prioritised for refactor.
3. Identified need for unified tooling and documentation to drive subsequent phases.

Next: proceed to **Phase 2 – Tooling & Standards**, focusing on workspace-wide lint/test enforcement, TypeScript alignment, and CI baseline.

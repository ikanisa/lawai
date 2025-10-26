# Refactor Readiness Taskboard (2025-02-22)

This taskboard turns the baseline audit into a prioritised backlog that the team can execute sprint-by-sprint. Each card now carries:

- **Impact tier** – whether the work unlocks immediate deploy stability, de-risks refactors, or sets up longer-term governance.
- **Acceptance criteria** – tangible completion checks to make code review and production promotion smoother.
- **Dependencies** – upstream tasks that should land first to avoid rework.

Use the "Start Task" buttons to move items into your chosen tracker.

## 0. Execution Roadmap

| Wave | Focus | Why it matters before production deploys |
| --- | --- | --- |
| Wave A | Toolchain alignment + git hygiene (Tasks 1.1, 2.1, 2.3) | Guarantees contributors run the same commands that CI and the runtime expect, preventing broken previews. |
| Wave B | Dependency + environment hardening (Tasks 2.2, 4.1, 4.2) | Ensures builds pass consistently and secrets are ready for production rollout. |
| Wave C | Architecture documentation + governance (Tasks 3.1, 5.1, 5.2) | Keeps future fullstack work coordinated and reviewable once stability is in place. |

## 1. Git Topology & Merge Targets

### Task 1.1 — Attach upstream remote and track `main`
- **Impact**: 🔴 Immediate (blocker for PR review)
- **Acceptance criteria**:
  1. `git remote -v` shows the canonical GitHub repository with `origin`.
  2. Local `main` branch is created and set to track `origin/main`.
  3. Onboarding docs (README or `/docs`) note `main` as the merge target for production deploys.
- **Dependencies**: None (kick off first).
- **Why now**: Without a remote/default branch, deployment automation (`deploy.yml`) cannot trigger from review merges.【F:docs/audit/2025-02-22_repo_baseline.md†L4-L13】【F:.github/workflows/deploy.yml†L1-L33】
- **Deliverables**: Remote configuration guide, updated branch tracking instructions, link to PR workflow checklist.

<button data-task="task-1-1">Start Task</button>

## 2. Toolchain & Dependency Alignment

### Task 2.1 — Standardise on pnpm across docs & automation
- **Impact**: 🔴 Immediate (build reproducibility)
- **Acceptance criteria**:
  1. Root `package.json` `packageManager` set to `pnpm@<current version>` and scripts use `pnpm` commands.
  2. CI workflows (`ci.yml`, `monorepo-ci.yml`) install with pnpm only and cache appropriately.
  3. README/CONTRIBUTING explicitly instruct pnpm usage and remove npm-specific flags.
- **Dependencies**: Task 1.1 (branch alignment helps once PRs start flowing).
- **Why now**: Mixed npm/pnpm usage causes lockfile drift and inconsistent preview builds.【F:README.md†L19-L74】【F:package.json†L1-L38】【F:.github/workflows/monorepo-ci.yml†L1-L32】
- **Deliverables**: Updated manifests, CI jobs, contributor docs, and a smoke test ensuring `pnpm install` works cleanly.

<button data-task="task-2-1">Start Task</button>

### Task 2.2 — Reconcile workspace dependency drift
- **Impact**: 🟠 Near-term (stability + DX)
- **Acceptance criteria**:
  1. `pnpm install --frozen-lockfile` succeeds across all apps without peer/missing dependency warnings.
  2. Workspace manifests (e.g., `apps/web/package.json`) include required UI libraries such as `framer-motion`, `docx`, `file-saver`.
  3. Add pnpm `overrides` or root `devDependencies` to pin shared toolchain packages (`@types/node`, `eslint`, `typescript`, `vitest`).
  4. Document regression command (e.g., `pnpm lint:deps`) and wire it into CI.
- **Dependencies**: Task 2.1 (pnpm standardisation).
- **Why now**: Current `npm ls --workspaces` output shows dozens of missing/invalid packages that will break reproducible builds.【3ba4c4†L1-L120】
- **Deliverables**: Updated lockfile/manifests, dependency audit report, CI hook.

<button data-task="task-2-2">Start Task</button>

### Task 2.3 — Decide on pnpm `m` usage or remove vestiges
- **Impact**: 🟡 Medium-term (DX clarity)
- **Acceptance criteria**:
  1. Either document pnpm `m` plugin setup in README + scripts, or remove `pnpm m` references from docs/scripts entirely.
  2. If keeping, add `pnpm dlx @pnpm/cli-plugin-m` install step to dev setup and CI.
  3. Confirm `pnpm m list` (or replacement) returns expected workspace info in CI logs.
- **Dependencies**: Task 2.1 (pnpm baseline).
- **Why now**: Avoids new contributors following dead commands from prior tooling guidance.【F:docs/audit/2025-02-22_repo_baseline.md†L14-L17】
- **Deliverables**: Updated docs/scripts, optional automation snippet for plugin bootstrapping.

<button data-task="task-2-3">Start Task</button>

## 3. Architecture & Shared Contracts

### Task 3.1 — Promote Mermaid architecture diagrams to canonical docs
- **Impact**: 🟡 Medium-term (shared understanding)
- **Acceptance criteria**:
  1. Create `docs/architecture/overview.md` housing the system context + deployment mermaid diagrams.
  2. Link the diagrams from README and relevant app-specific docs (API, web, ops) for discoverability.
  3. Annotate ownership (e.g., "Updated when Supabase schemas or legacy hosting platform routing changes").
- **Dependencies**: Wave A tasks (ensures doc updates align with new CONTRIBUTING flow).
- **Why now**: Keeps fullstack squads aligned during upcoming refactors across API/web/Supabase surfaces.【F:docs/audit/2025-02-22_repo_baseline.md†L27-L66】
- **Deliverables**: Architecture doc, cross-links, maintenance note.

<button data-task="task-3-1">Start Task</button>

## 4. Environment Variables & Secrets Hygiene

### Task 4.1 — Consolidate environment matrices & remove duplication
- **Impact**: 🟠 Near-term (deployment readiness)
- **Acceptance criteria**:
  1. Publish a matrix (table or JSON schema) mapping each variable to the services/CI jobs that require it.
  2. Reduce duplication by referencing a shared `.env.defaults` or generator for overlapping secrets.
  3. Validate `.env.example` files via a shared Zod schema or script executed in CI.
- **Dependencies**: Task 2.1 (consistent scripts) and Task 2.2 (healthy installs for the validation tooling).
- **Why now**: Divergent `.env.example` guidance risks failed Supabase or production deploys when teams follow different files.【F:.env.example†L1-L66】【F:apps/api/.env.example†L1-L38】【F:apps/web/.env.example†L1-L22】【F:apps/ops/.env.example†L1-L26】
- **Deliverables**: Central matrix doc, deduped env examples, validation script integrated into CI.

<button data-task="task-4-1">Start Task</button>

### Task 4.2 — Harden secrets management for Supabase & OpenAI deploys
- **Impact**: 🟠 Near-term (production safety)
- **Acceptance criteria**:
  1. Document how secrets flow from local `.env` → GitHub Actions → production runtime configuration → Supabase.
  2. Implement preflight checks in `scripts/deployment-preflight.mjs` (or successor script) that fail fast if required secrets are missing.
  3. Update `deploy.yml`/`preview.yml` with secret requirements and link documentation in PR template.
- **Dependencies**: Task 4.1 (shared matrix as source of truth).
- **Why now**: Smooths production deploys by making secret expectations explicit before code review merges.【F:.github/workflows/deploy.yml†L1-L112】
- **Deliverables**: Secret flow doc, enhanced preflight script, CI annotations.

<button data-task="task-4-2">Start Task</button>

## 5. Repository Governance & CI Gates

### Task 5.1 — Establish CODEOWNERS and commit/PR policy
- **Impact**: 🟡 Medium-term (review velocity)
- **Acceptance criteria**:
  1. Add `.github/CODEOWNERS` covering API, web, Supabase, and shared packages.
  2. Create `CONTRIBUTING.md` with commit message guidance (e.g., Conventional Commits) and PR checklist (lint/typecheck/test, `pnpm check:binaries`).
  3. Update PR template to reference required checks and environment validation before merge to `main`.
- **Dependencies**: Tasks 1.1 & 2.1 (ensures branch + tooling policies are clear beforehand).
- **Why now**: Gives reviewers confidence before promoting to production and encodes the governance recommendations from the audit.【F:docs/audit/2025-02-22_repo_baseline.md†L108-L122】
- **Deliverables**: CODEOWNERS file, CONTRIBUTING guide, PR template tweaks.

<button data-task="task-5-1">Start Task</button>

### Task 5.2 — Rationalise CI workflows to match the standard toolchain
- **Impact**: 🟡 Medium-term (CI cost + clarity)
- **Acceptance criteria**:
  1. Consolidate overlapping workflows so the single CI entrypoint runs lint → typecheck → test → build using pnpm.
  2. Ensure preview and production workflows share the same gate list, with environment checks from Tasks 4.x.
  3. Document promotion steps from preview to production in README or ops runbooks.
- **Dependencies**: Task 2.1 (pnpm), Task 2.2 (healthy dependency graph), Task 4.2 (secret checks).
- **Why now**: Prevents divergence between review builds and production deploys while keeping deployment pipelines simple.【F:.github/workflows/ci.yml†L1-L92】【F:.github/workflows/monorepo-ci.yml†L1-L32】【F:.github/workflows/preview.yml†L1-L41】【F:.github/workflows/deploy.yml†L1-L112】
- **Deliverables**: Updated workflow YAMLs, runbook snippet, CI badge update if applicable.

<button data-task="task-5-2">Start Task</button>

## 6. API Domain & Integrations

### Task 6.1 — Finish modularising workspace routes
- **Impact**: 🟠 Near-term (reduces regression risk)
- **Acceptance criteria**:
  1. Move the remaining `/workspace` implementation out of `server.ts` into `domain/workspace/routes.ts` and delete the TODO.
  2. Cover the route with Fastify integration tests that exercise Supabase mocks for happy/error paths.
  3. Update API docs or README to point to the modular route for future contributions.
- **Dependencies**: Task 2.2 (ensures Supabase client dependencies are aligned).
- **Why now**: The domain route still references the legacy logic via a TODO, so features risk diverging between modules.【F:apps/api/src/domain/workspace/routes.ts†L5-L32】
- **Deliverables**: Refactored route module, deleted legacy code in `server.ts`, new integration test file, documentation note.

<button data-task="task-6-1">Start Task</button>

### Task 6.2 — Add coverage for WhatsApp OTP providers
- **Impact**: 🟠 Near-term (protects messaging integrations)
- **Acceptance criteria**:
  1. Create contract tests for both Meta and Twilio adapters that assert request payloads/headers without hitting the network.
  2. Extend env validation so production deploys fail fast when WhatsApp secrets are placeholders.
  3. Document configuration differences (token format, locale defaults) alongside the environment examples.
- **Dependencies**: Task 4.1 (central secret matrix) and Task 4.2 (preflight checks) to reuse validation primitives.
- **Why now**: The adapters rely on critical env keys and silent fallbacks to the console adapter; missing coverage could break OTP flows unnoticed.【F:apps/api/src/whatsapp.ts†L13-L125】【F:apps/api/src/config.ts†L26-L67】
- **Deliverables**: Vitest suite with adapter spies, stricter env schema, WhatsApp section in deploy docs.

<button data-task="task-6-2">Start Task</button>

## 7. Web Console & PWA Experience

### Task 7.1 — Harden the service worker build pipeline
- **Impact**: 🟠 Near-term (prevents offline regressions)
- **Acceptance criteria**:
  1. Add assertions that `prepare-sw.mjs` and `inject-sw.mjs` run inside CI builds with failing exit codes on missing templates.
  2. Capture generated `public/sw.js` as an artefact in preview builds for QA to validate caching.
  3. Document recovery steps in the web app README if Workbox injection fails.
- **Dependencies**: Task 2.1 (pnpm standardisation) so scripts run identically locally and in CI.
- **Why now**: Current scripts log failures but do not gate builds, allowing broken PWAs to ship silently.【F:apps/web/scripts/prepare-sw.mjs†L1-L18】【F:apps/web/scripts/inject-sw.mjs†L1-L21】
- **Deliverables**: CI hook or Next.js build step, preview artefact config, troubleshooting doc updates.

<button data-task="task-7-1">Start Task</button>

### Task 7.2 — Align web environment docs with shared defaults
- **Impact**: 🟡 Medium-term (onboarding clarity)
- **Acceptance criteria**:
  1. Reconcile differences between `.env.example` and `apps/web/.env.example`, clarifying which keys are public vs. server-only.
  2. Provide a generator script or `pnpm web:env` command that seeds required keys for local dev.
  3. Link the consolidated guidance from README and taskboard wave docs.
- **Dependencies**: Task 4.1 (environment matrix) to avoid duplicating the mapping effort.
- **Why now**: The web sample env diverges from the root example, risking misconfigured Supabase service-role usage in client components.【F:.env.example†L8-L84】【F:apps/web/.env.example†L1-L24】
- **Deliverables**: Updated env samples, helper script, README pointers.

<button data-task="task-7-2">Start Task</button>

## 8. Supabase Data & Scheduling

### Task 8.1 — Verify edge function cron coverage
- **Impact**: 🟠 Near-term (data freshness & compliance)
- **Acceptance criteria**:
  1. Audit deployed edge functions against `function_schedules.json` and document any missing scheduler entries in Supabase or cron tooling.
  2. Add automated drift detection that fails CI when schedules change without review.
  3. Publish a runbook clarifying expected cadences and escalation paths for late jobs.
- **Dependencies**: Task 4.2 (secrets hardening) to ensure cron jobs can read required tokens.
- **Why now**: Multiple critical jobs (crawl-authorities, transparency digest) depend on cron coverage defined only in JSON, with no automated enforcement today.【F:supabase/function_schedules.json†L1-L17】
- **Deliverables**: Scheduler audit report, CI check or script, updated ops documentation.

<button data-task="task-8-1">Start Task</button>

### Task 8.2 — Consolidate migration sources before schema changes
- **Impact**: 🟡 Medium-term (migration safety)
- **Acceptance criteria**:
  1. Ensure contributors use `db/migrations` exclusively and archive legacy `supabase/migrations` SQL with clear guidance.
  2. Automate verification that `migration_rename_map*.txt` entries stay in sync with generated IDs.
  3. Update Supabase README/CLI scripts to reference the canonical path only.
- **Dependencies**: Task 2.2 (dependency health) so database tooling runs consistently.
- **Why now**: The repo still includes deprecated migration folders alongside the active database directory, increasing the risk of drift during refactors.【F:supabase/migrations/README.migrations.md†L1-L6】【F:db/migrations/0000_enable_pgcrypto.sql†L1-L15】
- **Deliverables**: Cleanup PR, automated rename-map test, refreshed docs.

<button data-task="task-8-2">Start Task</button>

## 9. Ops Automation & CLI Tooling

### Task 9.1 — Add smoke tests for critical CLI flows
- **Impact**: 🟠 Near-term (deployment confidence)
- **Acceptance criteria**:
  1. Create Vitest suites that stub Supabase/OpenAI clients and exercise key CLI commands (`bootstrap`, `regulator-digest`, `rotate-secrets`).
  2. Wire the tests into CI so failures block promotion to `main`.
  3. Provide fixtures that mirror `.env` expectations to minimise setup friction.
- **Dependencies**: Task 4.1 (env matrix) to reuse canonical variables during test setup.
- **Why now**: Ops scripts currently run without automated coverage despite orchestrating migrations and reports for production readiness.【F:apps/ops/package.json†L5-L27】【F:apps/ops/src/index.ts†L1-L24】
- **Deliverables**: New test files, CI integration, fixture docs.

<button data-task="task-9-1">Start Task</button>

### Task 9.2 — Centralise ops environment loading
- **Impact**: 🟡 Medium-term (secret hygiene)
- **Acceptance criteria**:
  1. Extend `loadRequiredEnv` to emit structured diagnostics that integrate with the shared env validation from Task 4.x.
  2. Ensure server-side defaults (`env.server.ts`) map to the same keys as `.env.example` to prevent drift.
  3. Add documentation clarifying precedence between process env, server env, and CLI flags.
- **Dependencies**: Task 4.1 (environment matrix) and Task 4.2 (preflight scripts).
- **Why now**: Ops tooling currently duplicates validation logic and may diverge from shared defaults during refactors.【F:apps/ops/src/lib/env.ts†L1-L37】【F:apps/ops/src/env.server.ts†L1-L46】【F:.env.example†L64-L85】
- **Deliverables**: Refined env loader, shared validation utilities, updated ops README.

<button data-task="task-9-2">Start Task</button>

## 10. Shared Contracts & Cross-App Consistency

### Task 10.1 — Version shared orchestrator contracts
- **Impact**: 🟡 Medium-term (backwards compatibility)
- **Acceptance criteria**:
  1. Introduce semantic versioning metadata for orchestrator DTOs and document migration strategy for breaking changes.
  2. Generate typed clients for API/web/ops that consume the contracts to avoid manual drift.
  3. Add CI checks ensuring consumer packages pin to the published version.
- **Dependencies**: Task 6.1 (modular API routes) so generated clients target stable endpoints.
- **Why now**: The shared package exposes extensive orchestrator shapes without versioning, making coordinated refactors risky.【F:packages/shared/src/orchestrator.ts†L1-L116】
- **Deliverables**: Versioned schema, release notes workflow, consumer update guide.

<button data-task="task-10-1">Start Task</button>

### Task 10.2 — Align PWA data schemas across services
- **Impact**: 🟡 Medium-term (UX consistency)
- **Acceptance criteria**:
  1. Confirm API responses and Supabase tables adhere to the shared PWA zod schemas, adding validation where gaps exist.
  2. Generate TypeScript types from the schemas for API and web clients instead of duplicating definitions.
  3. Create contract tests ensuring breaking changes in shared schemas trigger consumer updates.
- **Dependencies**: Task 7.1 (PWA pipeline) and Task 8.1 (cron coverage) for end-to-end scenario validation.
- **Why now**: Shared PWA schemas cover run states, tool events, and research payloads; drift would surface as runtime errors in the console during deploys.【F:packages/shared/src/pwa.ts†L1-L167】
- **Deliverables**: Generated types, contract tests, documentation on schema change workflow.

<button data-task="task-10-2">Start Task</button>

---

**Implementation Guidance**

1. Execute Wave A before merging feature work so that every PR follows the same pnpm + `main` expectations.
2. Bundle Tasks 2.2, 4.1, and 4.2 into a "deployment readiness" epic—finish them prior to scheduling production deploys.
3. Close with architecture/governance tasks once the pipeline is stable, enabling confident iteration on fullstack features across API, web, and Supabase services.

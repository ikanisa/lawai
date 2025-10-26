# Repository Deep Analysis & Task Backlog

## Architecture Snapshot
- The monorepo is a PNPM workspace spanning a Fastify agent API, Next.js operator console, Supabase integrations, and operational tooling for ingestion, evaluations, and compliance automation (see `README.md`).
- API composition still leans on a monolithic `server.ts` with inline orchestration, compliance, and workspace logic, while the newer domain modules (for example `domain/workspace`) expose only placeholder handlers (`apps/api/src/app.ts`, `apps/api/src/domain/workspace/routes.ts`, `apps/api/src/server.ts`).
- The front-end relies on demo organisation/user identifiers and registers a service worker unconditionally, signalling that authentication, tenancy, and PWA opt-in require production hardening (`apps/web/src/lib/api.ts`, `apps/web/src/components/providers.tsx`, `apps/web/src/lib/pwa.ts`).
- Compliance acknowledgement writes and rate limiting both operate with minimal safeguards—ack events are inserted without transactional guarantees and rate limits stay in-memory for a single telemetry endpoint—leaving resilience work outstanding (`apps/api/src/server.ts`, `apps/api/src/rate-limit.ts`).

## Backlog
Each backlog entry pairs the observed gap with success criteria, dependencies, and a quick-launch button so teams can file or start the work immediately.

### 1. Harden Fastify App Types & Modularisation
- **Context:** `createApp` currently disables TypeScript (`// @ts-nocheck`), and core routes still live inside `server.ts`, blocking strict typing and unit isolation for compliance, workspace, and orchestration flows (`apps/api/src/app.ts`, `apps/api/src/server.ts`).
- **Outcome:** Remove the `@ts-nocheck` directive, resolve typing gaps, and migrate remaining `server.ts` logic into dedicated domain route modules with shared schemas and tests.
- **Owner:** Platform API Guild
- **Dependencies:** Coordinate with Observability team to preserve logging and tracing spans during the extraction.

<button type="button" data-task="harden-fastify-types">Start task</button>

### 2. Promote Workspace Overview into Domain Module
- **Context:** The domain workspace route only returns a single run stub while the production-ready overview (jurisdiction desk, navigator, HITL inbox) still resides in `server.ts` with richer Supabase queries and guard rails (`apps/api/src/domain/workspace/routes.ts`, `apps/api/src/server.ts`).
- **Outcome:** Port the workspace overview implementation into `domain/workspace`, re-using shared extractors, adding schema validation, and wiring rate limiting.
- **Owner:** Operator Experience Team
- **Dependencies:** Requires Task 1 to expose typed context helpers.

<button type="button" data-task="workspace-domain">Start task</button>

### 3. Introduce Distributed Rate Limiting for Sensitive Routes
- **Context:** Only the telemetry endpoint uses `InMemoryRateLimiter`, leaving `/runs`, compliance, and ChatKit session endpoints unthrottled in multi-tenant scenarios (`apps/api/src/server.ts`, `apps/api/src/rate-limit.ts`).
- **Outcome:** Replace or augment the in-memory limiter with a shared store (Redis/Postgres) and enforce per-tenant quotas on run execution, compliance acknowledgements, and session management routes.
- **Owner:** Platform Reliability
- **Dependencies:** Coordinate with Infra to provision the backing data store and with Auth to align identifier keys.

<button type="button" data-task="distributed-rate-limits">Start task</button>

### 4. Make Compliance Acknowledgements Transactional & Idempotent
- **Context:** Compliance acknowledgements batch inserts into `consent_events` without wrapping in transactions or idempotency keys, so partial failures can produce duplicate or missing records (`apps/api/src/server.ts`).
- **Outcome:** Persist acknowledgements via stored procedures or explicit transactions, enforce idempotency by (`org_id`,`user_id`,`consent_type`,`version`), and emit audit logs for retries.
- **Owner:** Compliance Engineering
- **Dependencies:** Requires Supabase RPC updates and regression coverage in `apps/ops` Go/No-Go checks.

<button type="button" data-task="transactional-acks">Start task</button>

### 5. Replace Demo Identity Constants with Real Auth Context
- **Context:** Front-end data hooks and compliance banner components hardcode `DEMO_ORG_ID`/`DEMO_USER_ID`, preventing per-tenant audit trails once authentication is enabled (`apps/web/src/lib/api.ts`, `apps/web/src/components/compliance-banner.tsx`).
- **Outcome:** Thread authenticated org/user context from the session provider through API helpers, introduce suspense states for anonymous sessions, and update server guards accordingly.
- **Owner:** Identity & Access Team
- **Dependencies:** Align with API auth middleware extracted in Task 1.

<button type="button" data-task="replace-demo-ids">Start task</button>

### 6. Gate PWA Registration & Notification Prompts
- **Context:** `AppProviders` registers the service worker on mount and notification helpers immediately request permissions, which is risky for staging or regulated tenants (`apps/web/src/components/providers.tsx`, `apps/web/src/lib/pwa.ts`).
- **Outcome:** Guard registration behind `NEXT_PUBLIC_ENABLE_PWA`, persist tenant opt-in state, and expose telemetry to confirm adoption before default rollout.
- **Owner:** Front-End Platform
- **Dependencies:** Requires Task 5 to read tenant preferences from authenticated context.

<button type="button" data-task="gate-pwa">Start task</button>

### 7. Type-Safe Supabase Service Client
- **Context:** The API casts the Supabase service client through `unknown`, masking schema drift and bypassing generated typings from `@avocat-ai/supabase` (`apps/api/src/supabase-client.ts`).
- **Outcome:** Export correctly typed helpers from `@avocat-ai/supabase`, remove double casts, and add compile-time coverage for critical tables (`agent_runs`, `consent_events`, etc.).
- **Owner:** Data Platform
- **Dependencies:** Run Supabase type generation and update shared package exports.

<button type="button" data-task="typed-supabase">Start task</button>

### 8. Execute Finance PDF Ingestion Rollout
- **Context:** Phase 2 requires shipping the finance PDF ingestion program with ≥95% parse fidelity and no unresolved P0 compliance issues, as outlined in the rollout guide (`docs/agents/inventory.md`, `docs/agents/pdf-file-inputs.md`, `docs/planning/outstanding_phased_plan.md`).
- **Outcome:** Follow the staged rollout (source tagging → dry run → QA → production enablement), deliver telemetry on parse fidelity, and close out compliance sign-off.
- **Owner:** Data Platform & Ingestion Team
- **Dependencies:** Coordinate with Compliance Engineering for guardrail mapping and update the phase tracker when the rollout reaches production.

<button type="button" data-task="pdf-rollout">Start task</button>

## Next Steps
- Review task ownership during the weekly launch sync and record owners/start dates in the Go/No-Go tracker.
- Mirror this backlog in the operations CLI (`pnpm ops:phase --json`) once items transition to “In Progress” so dashboards stay synchronised.

# Repository Technical Analysis and Task Board

## Overview
- **Monorepo layout:** PNPM workspace combining a Fastify API (`apps/api`), a Next.js operator console (`apps/web`), operational CLI tooling (`apps/ops`), Supabase Edge functions, and shared packages for schemas and Supabase helpers.【F:README.md†L1-L55】
- **Production audit:** Existing go-live report already flags backend modularisation gaps, demo-only front-end assumptions, and readiness risks around rate limiting and authentication.【F:docs/launch/production_audit.md†L1-L72】
- **Environment guarantees:** Runtime env schemas across API and ops enforce secret presence but still allow placeholder defaults for Supabase URLs and vector store identifiers that would fail in a real deployment unless overridden.【F:apps/api/src/config.ts†L8-L54】【F:apps/ops/src/env.server.ts†L1-L40】

## Deep-Dive Findings

### Backend (Fastify API)
- `createApp` is still guarded by `// @ts-nocheck`, masking type regressions on the central router registration path and leaving the migration to domain modules incomplete.【F:apps/api/src/app.ts†L1-L69】
- Critical compliance, workspace, and metrics routes remain embedded in `server.ts`, relying on shared helpers without per-route isolation or durable rate limiting beyond the telemetry endpoint.【F:apps/api/src/server.ts†L1-L841】【F:apps/api/src/server.ts†L73-L95】
- The new workspace domain module is a stub that only fetches a run ID and still points to a TODO referencing `server.ts`, signalling unfinished refactors and duplicated Supabase access logic.【F:apps/api/src/domain/workspace/routes.ts†L9-L33】
- Compliance acknowledgement persistence batches inserts without idempotency or transactional guarantees, increasing the risk of duplicate consent rows under retries or partial failures.【F:apps/api/src/server.ts†L772-L841】

### Front-End (Next.js Operator Console)
- API helpers export demo organisation/user IDs that the compliance banner, queries, and mutations rely on, meaning every session impersonates the same tenant until proper auth wiring is added.【F:apps/web/src/lib/api.ts†L11-L120】【F:apps/web/src/components/compliance-banner.tsx†L1-L109】
- Global providers register the PWA service worker on mount for all environments, forcing Workbox into staging or server-rendered contexts where it may not be desired.【F:apps/web/src/components/providers.tsx†L19-L38】【F:apps/web/src/lib/pwa.ts†L1-L56】

### Operational Tooling & Edge Functions
- Supabase Edge `regulator-digest` function hardcodes fallback API endpoints, tenant identifiers, and service tokens, exposing demo values instead of deriving them from configuration or secret storage.【F:supabase/functions/regulator-digest/index.ts†L1-L76】
- Ops environment schema enforces presence of core Supabase credentials but leaves execution context-specific IDs optional, making it easy to run destructive commands against the wrong tenant without explicit scoping guidance.【F:apps/ops/src/env.server.ts†L8-L38】

### Shared Infrastructure
- Supabase service client casts to `unknown` before returning, losing the generated helper typings and increasing the chance of runtime shape mismatches in callers.【F:apps/api/src/supabase-client.ts†L1-L8】
- Vector store configuration defaults to placeholder IDs, creating runtime coupling between API, ops tooling, and Supabase ingestion flows that needs consolidation once the production store is provisioned.【F:apps/api/src/config.ts†L8-L41】【F:apps/ops/src/env.server.ts†L8-L24】

## Recommended Tasks

### Harden Fastify core and complete route modularisation
Remove `@ts-nocheck` from `createApp`, migrate legacy `/compliance`, `/workspace`, and `/runs` handlers into domain modules with typed contexts, and expand rate limiting beyond telemetry-only coverage.【F:apps/api/src/app.ts†L1-L69】【F:apps/api/src/server.ts†L1-L95】【F:apps/api/src/domain/workspace/routes.ts†L9-L33】

:::task-stub{title="Harden Fastify core and migrate legacy routes"}
1. Audit `apps/api/src/server.ts` for remaining high-risk handlers (compliance, workspace, metrics) and design module boundaries under `apps/api/src/domain/*`.
2. Port each route into its module with Fastify plugins, Zod schemas, and shared context typing; remove `// @ts-nocheck` once types compile.
3. Extend `InMemoryRateLimiter` usage or introduce a persistent store (Redis) for compliance and run execution endpoints; add integration tests in `apps/api/test`.
4. Delete or drastically slim the legacy `server.ts`, keeping only the bootstrap needed until all routes are modularised.
:::

### Productionise compliance acknowledgement storage
Introduce idempotent writes or transactional logic around consent events to avoid duplicate rows when retries occur, and expose failure telemetry for observability.【F:apps/api/src/server.ts†L772-L841】

:::task-stub{title="Stabilise compliance acknowledgement persistence"}
1. Implement an upsert or RPC in `apps/api/src/domain/compliance` (new module) wrapping `recordAcknowledgementEvents` with transaction semantics.
2. Add deduplication keys (`org_id`, `user_id`, `consent_type`, `version`) and retry-safe logic, emitting structured logs on conflict.
3. Cover scenarios with Vitest integration tests to confirm no duplicate Supabase writes and ensure API responses remain unchanged.
:::

### Replace demo tenant plumbing with authenticated context
Wire session-aware organisation/user identifiers through Next.js App Router loaders and API helpers so compliance queries, mutations, and trust panels execute under the signed-in tenant.【F:apps/web/src/lib/api.ts†L11-L144】【F:apps/web/src/components/compliance-banner.tsx†L17-L97】

:::task-stub{title="Implement authenticated tenant context on the web app"}
1. Add an auth provider (Supabase Auth or SSO) in `apps/web/src/components/providers.tsx` that exposes org/user IDs via context.
2. Refactor `apps/web/src/lib/api.ts` to accept tenant identifiers from the context rather than constants; update all hooks/components consuming it.
3. Ensure requests forward `x-org-id`/`x-user-id` headers and add integration tests plus guarded fallbacks for unauthenticated states.
:::

### Gate PWA registration behind environment and user intent
Avoid automatically registering service workers; require an explicit flag (e.g., `NEXT_PUBLIC_ENABLE_PWA`) and user opt-in from the install prompt provider.【F:apps/web/src/components/providers.tsx†L19-L38】【F:apps/web/src/lib/pwa.ts†L1-L56】

:::task-stub{title="Gate PWA enablement"}
1. Introduce an env-controlled guard in `registerPwa` and check it within `AppProviders` before registration.
2. Defer registration until the user opts in via `PwaInstallProvider`, ensuring SSR and test environments skip Workbox.
3. Update documentation and add unit tests in `apps/web/test` to confirm registration only occurs under the configured flag + consent.
:::

### Secure Supabase Edge regulator digest dispatch
Parameterise the edge function with secret-managed configuration and robust error handling instead of demo defaults for org/user IDs and tokens.【F:supabase/functions/regulator-digest/index.ts†L13-L76】

:::task-stub{title="Harden regulator digest edge function"}
1. Load required identifiers (`ORG_ID`, `USER_ID`, service token) from environment with validation and fail fast when missing.
2. Replace demo fallback values with descriptive errors; document expected configuration in `docs/operations`.
3. Add integration tests or dry-run scripts to validate payload normalisation without exposing secrets.
:::

### Restore typed Supabase client exports
Return the generated Supabase client type rather than an `unknown` cast so downstream modules keep schema awareness and RLS-safe queries.【F:apps/api/src/supabase-client.ts†L1-L8】

:::task-stub{title="Return typed Supabase service client"}
1. Update `@avocat-ai/supabase` helpers to export the precise `SupabaseClient` type and remove the `unknown` cast.
2. Adjust API modules to rely on typed responses, adding compile-time coverage for column access and select projections.
3. Run affected tests to ensure no runtime regressions and document the helper usage for other packages.
:::

### Consolidate vector store configuration
Align vector store identifiers across API, ops CLI, and ingestion tooling so production deployments do not rely on placeholder defaults.【F:apps/api/src/config.ts†L8-L41】【F:apps/ops/src/env.server.ts†L8-L24】

:::task-stub{title="Unify vector store configuration"}
1. Define a shared configuration module (e.g., `packages/shared/src/vector-store.ts`) that sources the store ID with validation.
2. Update API and ops code to consume the shared helper and surface actionable errors when IDs are missing.
3. Extend operational runbooks to reflect the single source of truth and add CI checks preventing placeholder usage in production.
:::

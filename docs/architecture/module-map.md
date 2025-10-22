# Backend module map

## Core domains

### Orchestrator
- Entry point: `apps/api/src/orchestrator.ts` implements command/session lifecycle (enqueue, safety review, job tracking) and is now consumed via the layered services in `apps/api/src/core/services/orchestrator-service.ts`.【F:apps/api/src/orchestrator.ts†L1-L520】【F:apps/api/src/core/services/orchestrator-service.ts†L1-L208】
- HTTP transport registered through `apps/api/src/http/routes/orchestrator.ts`, which delegates to controllers/services to decouple transport from Supabase/OpenAI details.【F:apps/api/src/http/routes/orchestrator.ts†L1-L205】

### Connectors
- External systems handled in `apps/api/src/connectors/*` with typed clients for ERP, GRC, analytics, tax, etc.【F:apps/api/src/connectors/index.ts†L1-L88】
- Connector registry surfaced to HTTP via orchestrator service coverage mapping (`mapConnectorCoverage`).【F:apps/api/src/core/services/orchestrator-service.ts†L64-L109】

### Compliance & audit
- Compliance acknowledgements and device/session guardrails implemented in `apps/api/src/compliance.ts` and `apps/api/src/device-sessions.ts` to enforce policy before orchestrator actions execute.【F:apps/api/src/compliance.ts†L1-L160】【F:apps/api/src/device-sessions.ts†L1-L160】
- Audit trail writer lives at `apps/api/src/audit.ts`, invoked from orchestrator and SCIM flows for traceability.【F:apps/api/src/audit.ts†L1-L120】

### Finance
- Finance manifest and workers are defined in `apps/api/src/finance-manifest.ts` and `apps/api/src/finance-workers.ts`, describing domain-specific connectors and async job handlers consumed by the orchestrator service when validating payloads/results.【F:apps/api/src/finance-manifest.ts†L1-L200】【F:apps/api/src/finance-workers.ts†L1-L160】

## Cross-cutting concerns

### Logging, tracing, metrics
- Observability middleware (`apps/api/src/core/observability/observability-plugin.ts`) injects trace IDs, structures request logs, and increments counters per route; `withRequestSpan` enables ad hoc spans for deeper diagnostics.【F:apps/api/src/core/observability/observability-plugin.ts†L1-L63】【F:apps/api/src/observability/spans.ts†L1-L40】

### Authentication & rate limiting
- Auth guard (`apps/api/src/http/authorization.ts`) combines access-control policy, device session recording, and compliance checks before controller logic executes; rate-limiting handled by `apps/api/src/rate-limit.ts`.【F:apps/api/src/http/authorization.ts†L1-L40】【F:apps/api/src/rate-limit.ts†L1-L120】

### Schema validation & types
- Central Zod registry (`apps/api/src/core/schema/registry.ts`) registers HTTP schemas and generates static types to `apps/api/src/core/schema/registry-types.d.ts`, enabling DTO reuse across layers.【F:apps/api/src/core/schema/registry.ts†L1-L73】【F:apps/api/src/core/schema/registry-types.d.ts†L1-L80】

### Graceful lifecycle
- Signal-aware shutdown in `apps/api/src/core/lifecycle/graceful-shutdown.ts` closes Fastify cleanly, and `apps/api/src/app.ts` wires dependencies via the DI container to ensure Supabase/OpenAI integrations remain isolated to repositories/gateways.【F:apps/api/src/core/lifecycle/graceful-shutdown.ts†L1-L37】【F:apps/api/src/app.ts†L1-L65】

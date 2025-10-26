# API Module Map

This document maps the primary runtime modules in the API service and highlights the cross-cutting concerns that influence their design.

## Core Domains

### Orchestrator (`apps/api/src/orchestrator.ts`, `apps/api/src/core/*`)
* Coordinates finance-automation jobs, commands, safety assessments, and connector orchestration.
* Uses the layered stack (`core/controllers`, `core/services`, `core/repositories`) with Supabase persistence (`core/infrastructure/supabase`) and OpenAI safety assessments (`core/infrastructure/openai`).
* Cross-cutting concerns: structured logging (Pino instances injected through Fastify), safety/compliance metrics (`observability/metrics.ts`), request-scoped tracing (observability plugin), and rate limiting when exposed via HTTP routes (`http/routes/orchestrator.ts`).

### Connectors (`apps/api/src/connectors/*`)
* Normalises access to upstream ERP, regulatory, analytics, and tax systems.
* Consumed by orchestrator jobs and finance tooling to satisfy dependency checks.
* Cross-cutting concerns: authentication secrets sourced via configuration (`config.ts`), request logging/instrumentation handled by services that call these clients, and error propagation into orchestrator telemetry.

### Compliance (`apps/api/src/compliance.ts`, `apps/api/src/audit.ts`)
* Evaluates IRAC payloads for FRIA/CEPEJ obligations and records audit trails.
* Relies on observability spans (`observability/spans.ts`) and Supabase RPC helpers (`supabase-client.ts`) for storage.
* Cross-cutting concerns: logging, access control guards (`http/authorization.ts`), and metrics counters emitted for acknowledgement events.

### Finance (`apps/api/src/finance-*.ts`, `apps/api/src/launch.ts`)
* Declares capability manifests, financial worker orchestration, and launch flows.
* Uses orchestrator repositories for persistent queues, and shares access-control/rate-limiting with API routes.
* Cross-cutting concerns: logging, safety-guard integration, rate limiting for telemetry endpoints, and OpenAI usage mediated through services (`openai.ts`).

### Workspace (`apps/api/src/domain/workspace/*`)
* Exposes workspace dashboards for finance runs and session state.
* Now follows the layered architecture (routes → controller → service → repository) with Supabase isolated behind an interface.
* Cross-cutting concerns: Fastify observability middleware (trace IDs, metrics), schema validation, and authorization guards when combined with other routes.

### API Plugins (`apps/api/src/plugins/*`)
* `workspace.ts`, `compliance.ts`, and `agent-runs.ts` compose rate limiters, guards, and feature routes around the shared Fastify instance created in `app.ts`.
* Each plugin receives the mutable `AppContext` so guards/limiters can be surfaced to legacy routes while new domain modules stay isolated.
* Cross-cutting concerns: consistent rate-limiter factory usage, shared telemetry counters, and dependency injection for new orchestration services.

## Cross-Cutting Concerns

| Concern             | Location(s) | Notes |
| ------------------- | ----------- | ----- |
| Structured logging  | `src/app.ts` (Fastify logger), `core/observability/observability-plugin.ts` | Provides trace-aware child loggers per request. |
| Tracing IDs         | `core/observability/observability-plugin.ts` | Generates/propagates `x-trace-id`, records duration metrics. |
| Metrics             | `observability/metrics.ts`, incremented in observability plugin and compliance spans | Facilitates Prometheus-style counters. |
| Rate limiting       | `rate-limit.ts`, orchestrated by `plugins/*.ts` and remaining legacy routes | Centralises limiter creation per feature bucket. |
| Authentication & Guards | `http/authorization.ts`, `access-control.ts` | Centralised access checks and guard rails for routes and workers. |
| Schema validation   | `core/schema/registry.ts`, generated types in `registry-types.d.ts` | Ensures all HTTP payloads and services reuse defined Zod schemas. |
| Graceful shutdown   | `core/lifecycle/graceful-shutdown.ts` | Hooks Fastify close on `SIGINT`/`SIGTERM`, now extended to dispose container resources. |

Cross-module flows (e.g. orchestrator finance jobs) compose these concerns by acquiring controllers from the dependency-inverted container (`core/container.ts`), ensuring that external integrations (Supabase, OpenAI) remain swappable for testing and future platform shifts.

# Responses API Integration Audit

## Monorepo overview
- The workspace hosts Fastify APIs, Supabase Edge workers, an operator-facing Next.js console, operational CLIs, and shared packages bundled via PNPM. 【F:README.md†L1-L55】

## Backend API (apps/api)

### Observed state
- `createApp` wires many route modules but relies on lightweight stubs for agent execution and research streaming. 【F:apps/api/src/app.ts†L1-L68】【F:apps/api/src/routes/agents/index.ts†L29-L107】
- The orchestration layer configures the `@openai/agents` SDK to run against the Responses API, but its outputs are only processed in-memory without storing response identifiers or intermediate traces. 【F:apps/api/src/agent.ts†L847-L920】
- Structured summarisation already calls `openai.responses.create` with JSON schema enforcement, yet it extracts only the first text chunk and lacks retry/telemetry hooks beyond a shared debug helper. 【F:apps/api/src/summarization.ts†L136-L231】【F:apps/api/src/openai.ts†L9-L61】

### Gaps & risks
- The `/api/agents/run` and `/api/agents/stream` endpoints fabricate runs and SSE payloads locally, so the operator console never exercises real Responses API traffic or orchestrator guardrails. 【F:apps/api/src/routes/agents/index.ts†L29-L107】
- Agents executed through `runAgent` do not persist `response_id`, token usage, or tool budget telemetry to Supabase, limiting audit trails required by CEPEJ/AI Act mappings. 【F:apps/api/src/agent.ts†L847-L935】
- Summaries lack back-pressure or partial failure reporting, which complicates monitoring and makes the Ops CLI unable to distinguish OpenAI errors from parsing bugs. 【F:apps/api/src/summarization.ts†L177-L228】

### Suggested tasks
1. **Replace simulated research runs with live orchestration.** Pipe `/api/agents/run` through the orchestrator so that `runAgent` executions stream real Responses API output, emit SSE from OpenAI chunks, and persist run state in Supabase for resumption/HITL. 【F:apps/api/src/routes/agents/index.ts†L29-L107】【F:apps/api/src/agent.ts†L847-L920】
2. **Capture and store Responses metadata.** Enrich the agent pipeline to log `response_id`, token usage, guardrail decisions, and tool telemetry into Supabase tables (and surface them via `logOpenAIDebug`) to satisfy governance checklists. 【F:apps/api/src/agent.ts†L847-L935】【F:apps/api/src/openai.ts†L9-L61】
3. **Harden summarisation retries and observability.** Extend `generateStructuredSummary` with streamed Responses handling, exponential back-off on parse errors, and structured logging so Ops tooling can differentiate OpenAI outages from schema regressions. 【F:apps/api/src/summarization.ts†L136-L228】

## Operator console (apps/web)

### Observed state
- The admin React client polls `/api/admin/*` endpoints but currently consumes mocked data via a fallback store instead of live Supabase/Responses telemetry. 【F:apps/web/src/features/admin-panel/api/client.ts†L14-L200】【F:apps/web/src/server/supabase/admin-client.ts†L119-L198】
- Server handlers focus on evaluation/ingestion stats without exposing Responses API usage, run health, or debug identifiers. 【F:apps/web/src/server/admin/handlers.ts†L45-L145】

### Suggested tasks
4. **Surface Responses run analytics in the console.** Add API handlers and UI cards showing live response latency, token usage, and guardrail hit rates sourced from the new Supabase run tables. 【F:apps/web/src/server/admin/handlers.ts†L45-L145】【F:apps/web/src/features/admin-panel/api/client.ts†L49-L138】
5. **Retire the fallback admin store.** Replace the in-memory seed data with authenticated Supabase queries (with graceful degradation) so operators view real Responses traffic even in staging. 【F:apps/web/src/server/supabase/admin-client.ts†L119-L198】

## Operational CLI (apps/ops)

### Observed state
- The CLI currently verifies Supabase connectivity and prints sample allowlist entries, but it has no hooks into Responses usage, rate limits, or stuck runs. 【F:apps/ops/src/index.ts†L1-L27】

### Suggested tasks
6. **Add Responses health subcommands.** Implement CLI routines that list active response runs, detect stuck streaming sessions, and cross-check token usage against quotas using the forthcoming Supabase run telemetry. 【F:apps/ops/src/index.ts†L1-L27】

## Shared libraries

### Observed state
- The shared OpenAI client normalises headers and supports debugging toggles, yet callers must opt-in manually and there is no helper for streaming Responses consumption or automatic cache scoping per service. 【F:packages/shared/src/openai/client.ts†L1-L176】

### Suggested tasks
7. **Provide a Responses streaming helper.** Introduce a utility in `@avocat-ai/shared/openai` that wraps `client.responses.create` with SSE iteration, request tagging, and debug logging so both API and Edge workers share consistent behaviour. 【F:packages/shared/src/openai/client.ts†L1-L176】

## Cross-cutting opportunities
- Align Supabase schemas, the Fastify API, Next.js admin views, and Ops tooling around a single source of truth for Responses API runs to meet CEPEJ transparency commitments and simplify legacy hosting platform deployment checks. 【F:README.md†L55-L160】【F:apps/api/src/agent.ts†L847-L935】【F:apps/web/src/server/admin/handlers.ts†L45-L145】

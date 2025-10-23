# Responses API Adoption Task Board

This board consolidates the actionable follow-ups required to align every surface of the Francophone monorepo with OpenAI's Responses API, spanning Fastify services, Supabase persistence, Next.js operator tooling, Edge workers, and operational CLIs outlined in the repository overview. 【F:README.md†L1-L74】

Each task links to a `start-task://` placeholder that workflow tooling can interpret as "Start task" actions.

## Quick navigation

| Task | Area | Focus | Start |
| --- | --- | --- | --- |
| T1 | Backend API | Replace stubbed agent runs with live Responses orchestration and SSE | [▶️ Start Task](start-task://responses-backend-stream) |
| T2 | Backend API & Database | Persist Responses metadata to Supabase with governance-friendly schemas | [▶️ Start Task](start-task://responses-telemetry-persistence) |
| T3 | Backend Services | Harden structured summarisation retries, observability, and streaming | [▶️ Start Task](start-task://responses-summarisation-hardening) |
| T4 | Operator Console API | Expose Responses analytics in admin handlers | [▶️ Start Task](start-task://responses-admin-api) |
| T5 | Operator Console UI | Replace fallback admin store with Supabase-backed telemetry views | [▶️ Start Task](start-task://responses-admin-ui) |
| T6 | Operational CLI | Add Responses health and quota diagnostics to ops toolkit | [▶️ Start Task](start-task://responses-ops-cli) |
| T7 | Shared Libraries | Provide reusable Responses streaming utilities in shared OpenAI client | [▶️ Start Task](start-task://responses-shared-streaming) |
| T8 | Edge Functions | Align Deno OpenAI helpers with Responses streaming + telemetry tags | [▶️ Start Task](start-task://responses-edge-alignment) |

---

## T1 – Replace simulated agent runs with live Responses orchestration
- Wire `/agents/run` and `/agents/stream` routes to the production orchestrator instead of the in-memory simulation that currently emits canned research traces via `createResearchStream`, preventing real Responses traffic or guardrails from surfacing in the console. 【F:apps/api/src/routes/agents/index.ts†L1-L108】
- Emit true SSE chunks from Responses streaming, handling client back-pressure and disconnects while updating run status in Supabase (see T2).

[▶️ Start Task](start-task://responses-backend-stream)

## T2 – Persist Responses metadata to Supabase with governance-friendly schemas
- Extend the agent execution pipeline so that `runAgent` captures `response_id`, token usage, guardrail decisions, and tool calls instead of simply returning the final payload. 【F:apps/api/src/agent.ts†L837-L895】
- Introduce Supabase migrations/tables and repository-layer helpers (e.g., via `supabase-client.ts`) to store run lifecycle rows, linking back to admin analytics. 【F:apps/api/src/supabase-client.ts†L1-L9】

[▶️ Start Task](start-task://responses-telemetry-persistence)

## T3 – Harden structured summarisation retries, observability, and streaming
- Upgrade `generateStructuredSummary` to stream partial outputs, add exponential back-off on JSON parse failures, and log OpenAI request IDs so Ops can separate model errors from parser issues. 【F:apps/api/src/summarization.ts†L136-L231】
- Surface structured telemetry through shared logging hooks to align with the Responses observability work in T2.

[▶️ Start Task](start-task://responses-summarisation-hardening)

## T4 – Expose Responses analytics in admin handlers
- Expand admin handler aggregates to include Responses latency, guardrail hits, and run volumes using the forthcoming Supabase telemetry instead of only evals/ingestion snapshots. 【F:apps/web/src/server/admin/handlers.ts†L1-L104】
- Return identifiers that link UI cards directly to stored `response_id` artifacts for operator drill-down.

[▶️ Start Task](start-task://responses-admin-api)

## T5 – Replace fallback admin store with Supabase-backed telemetry views
- Remove the seeded in-memory fallback store that currently masks missing Supabase data, ensuring the console displays live Responses usage and gracefully handles unavailable metrics. 【F:apps/web/src/server/supabase/admin-client.ts†L120-L260】
- Implement feature-flagged loading states and error surfaces that differentiate "no data yet" from actual API failures.

[▶️ Start Task](start-task://responses-admin-ui)

## T6 – Add Responses health and quota diagnostics to ops toolkit
- Extend the CLI beyond the current jurisdiction smoke test so operators can list active Responses runs, detect stuck streams, and compare aggregate token usage against quotas. 【F:apps/ops/src/index.ts†L1-L27】
- Output machine-readable JSON for CI gating, ensuring Vercel deploy checks block when telemetry drifts from policy thresholds.

[▶️ Start Task](start-task://responses-ops-cli)

## T7 – Provide reusable Responses streaming utilities in shared OpenAI client
- Introduce helpers inside `@avocat-ai/shared/openai` that wrap `client.responses.create` with SSE iteration, logging, and request tagging so backend and edge workers use a consistent implementation. 【F:packages/shared/src/openai/client.ts†L1-L120】
- Add debug hooks that propagate OpenAI request IDs to the persistence layer built in T2.

[▶️ Start Task](start-task://responses-shared-streaming)

## T8 – Align Deno OpenAI helpers with Responses streaming + telemetry tags
- Expand the Edge helper to offer Responses streaming support (currently limited to file and vector store utilities) so crawlers and schedulers can reuse the same instrumentation. 【F:apps/edge/lib/openai.ts†L1-L143】
- Standardise request-tag conventions with the shared library (T7) to improve cross-service tracing.

[▶️ Start Task](start-task://responses-edge-alignment)

# LawAI Refactor Plan (Evidence-Based)

## Baseline (What Exists Today)
- Core legal agent already uses the OpenAI Agents SDK in `apps/api/src/agent.ts` (imports from `@openai/agents`, builds `Agent`, uses `runAgent`, defines tools and output guardrails). Sources: `apps/api/src/agent.ts`.
- `/runs` is implemented in the legacy Fastify server (`apps/api/src/server.ts`), while a newer plugin-based app exists with separate route registration. Sources: `apps/api/src/server.ts` (route `POST /runs`), `apps/api/src/app.ts` (route registration), `apps/api/package.json` (dev script uses `src/server.ts`).
- Web client calls `/runs` and other endpoints via a thin API helper. Source: `apps/web/src/lib/api.ts` (submitResearchQuestion, fetchCorpus, fetchHitlQueue).
- Redline diff UI exists and can be reused for suggested edits. Source: `apps/web/src/components/drafting/redline-diff.tsx`.
- Evaluation CLI and SLO tooling exist in ops. Sources: `apps/ops/src/evaluate.ts`, `apps/ops/src/slo-report.ts`, `README.md` (ops:evaluate and SLO guidance).

## Workstream 1: Standardize Core Agent on OpenAI Agent SDK
Goal: Make a single, shared Agent SDK core that all runtimes call (API, MCP server, tests), and remove duplicate run entrypoints.

1) Extract legal agent into a shared package (or extend `packages/agent-kernel`) and expose a `LegalAgentKernel`.
   - Start from `apps/api/src/agent.ts` (tools, instructions, guardrails, hybrid retrieval) and move reusable logic to `packages/agent-kernel`.
   - Keep `apps/api/src/agent-wrapper.ts` as the boundary for input sanitization and audit logging, but point it at the shared kernel.
   - Evidence of current agent logic: `apps/api/src/agent.ts` (buildAgent, buildInstructions, persistRun).

2) Consolidate run entrypoints.
   - Choose either `apps/api/src/server.ts` or the plugin-based app in `apps/api/src/app.ts`, then remove the duplicate route implementation.
   - Ensure `/runs` returns tool logs, plan, notices, and trust panel consistently.
   - Evidence of duplication: `apps/api/src/server.ts` (POST /runs) vs `apps/api/src/plugins/agent-runs.ts` (POST /runs).

3) Align shared schemas and role vocabularies.
   - Resolve RBAC mismatch between `packages/shared/src/roles.ts` and `docs/SUPABASE_AND_AGENT_MANIFEST.yaml`.
   - Evidence: `packages/shared/src/roles.ts`, `docs/SUPABASE_AND_AGENT_MANIFEST.yaml` (rbac section).

Acceptance: One canonical `runLegalAgent` path, one `/runs` handler, and a shared kernel package used by API + tests.

## Workstream 2: MCP Server Tool Set
Goal: Provide an MCP server exposing domain tools for ChatGPT and internal clients.

Proposed tools and mappings to existing logic:
- `draft_contract`: start from `generate_pleading_template` + drafting templates data. Sources: `apps/api/src/agent.ts` (generate_pleading_template tool), `apps/web/src/components/drafting/drafting-view.tsx` (template rendering).
- `analyze_clause`: leverage `redline_contract` (diff + recommendation). Source: `apps/api/src/agent.ts` (redline_contract tool).
- `extract_obligations`: extend summarization + IRAC schema or add a dedicated extraction prompt. Sources: `apps/api/src/summarization.ts` (summary pipeline), `packages/shared/src/irac.ts` (IRAC schema).
- `summarize`: reuse `summariseDocumentFromPayload` or the summary pipeline. Source: `apps/api/src/summarization.ts`.
- `compare_versions`: reuse the diff pipeline (`diffWordsWithSpace` / redline diff). Sources: `apps/api/src/agent.ts` (redline_contract tool), `apps/web/src/components/drafting/redline-diff.tsx` (UI expectations).

Implementation notes:
- Add a new MCP server workspace (e.g., `apps/mcp`) that wraps these functions and reuses the shared kernel for model calls.
- Include allowlist enforcement and binding-language checks using the existing rules. Sources: `apps/api/src/agent.ts` (applyBindingLanguageNotices, isUrlAllowlisted), `packages/shared/src/constants/allowlist.ts`.

Acceptance: MCP server exposes the five tools with deterministic schemas and uses shared kernel utilities for citations and allowlist checks.

## Workstream 3: ChatGPT App UI Cards
Goal: Add UI cards for clause risk highlights, obligations checklist, and suggested edits (diff view).

1) Clause risk highlights card
   - Reuse risk metadata from IRAC payload (`risk.level`, `risk.why`) and trust panel summaries.
   - Evidence: `packages/shared/src/irac.ts` (risk fields), `apps/web/src/components/research/research-view.tsx` (RiskBanner usage).

2) Obligations checklist card
   - Add a new structured output field (e.g., `obligations`) in shared schema and surface it in Research/Drafting views.
   - Evidence for schema touchpoints: `packages/shared/src/irac.ts` (IRAC schema), `apps/web/src/components/research/research-view.tsx` (IRAC rendering).

3) Suggested edits card (diff view)
   - Use existing `RedlineDiff` component and wire to agent tool output or MCP `compare_versions`.
   - Evidence: `apps/web/src/components/drafting/redline-diff.tsx`, `apps/api/src/agent.ts` (redline_contract tool).

Acceptance: Three cards render in the ChatGPT app UI with data from agent outputs or MCP responses, using shared schema types.

## Workstream 4: Evaluation Tests + Latency Budgets
Goal: Make golden-set evaluations and latency budgets part of the refactor acceptance criteria.

- Golden sets: Expand existing eval CLI cases and add CI gates that call `/runs` with fixed prompts. Sources: `apps/ops/src/evaluate.ts` (fallback cases + benchmarks), `README.md` (ops:evaluate).
- Latency budgets: Use SLO snapshots and track P95 targets for HITL, retrieval, and citation precision. Sources: `apps/ops/src/slo-report.ts` (SLO CLI), `apps/web/src/components/admin/admin-view.tsx` (SLO metrics display).
- Add tests for tool outputs and schema conformance (IRAC + new obligations field). Sources: `packages/shared/src/irac.ts`, `apps/api/src/agent.ts` (output guardrail).

Acceptance: CI fails if golden sets regress or P95 budgets exceed thresholds; SLO snapshots are produced from the same pipeline.


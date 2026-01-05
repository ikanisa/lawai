# LawAI Refactor Task List (Phased, Evidence-Based)

This task list is derived from `docs/REFACTOR_PLAN_LAWAI.md` and anchored to the current codebase. Every task includes evidence and a concrete diff sketch.

## Owner Map (Evidence)
Platform Engineering owns platform services; Experience Engineering owns product experiences. Source: `docs/SYSTEM_OVERVIEW.md`.
Agents SDK Orchestrator work is assigned to the Intelligence Squad; Front-End & HITL Console work is assigned to the Experience Squad; Foundation/ops and learning loops are assigned to the Ops Squad. Source: `docs/implementation_guide.md`.

## Phase 0 — API Entrypoint + Stub Convergence

### P0-1: Choose a single API entrypoint and remove duplicate `/runs`
Owner: Platform Engineering.
Evidence: `apps/api/src/server.ts` (POST `/runs`), `apps/api/src/plugins/agent-runs.ts` (POST `/runs`), `apps/api/src/app.ts` (registers agentRunsPlugin), `apps/api/package.json` (dev script points to `src/server.ts`).
Diff sketch (Option A: run `createApp` and retire `/runs` in `server.ts`):
```diff
diff --git a/apps/api/src/entrypoint.ts b/apps/api/src/entrypoint.ts
new file mode 100644
--- /dev/null
+++ b/apps/api/src/entrypoint.ts
@@
+import { createApp } from './app.js';
+
+const port = Number.parseInt(process.env.PORT ?? '3333', 10);
+const host = process.env.HOST ?? '0.0.0.0';
+
+const { app } = await createApp();
+await app.listen({ port, host });
+app.log.info({ port, host }, 'api_listening');
diff --git a/apps/api/package.json b/apps/api/package.json
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@
-    "dev": "tsx src/server.ts",
+    "dev": "tsx src/entrypoint.ts",
```
Diff sketch (Option B: keep `server.ts` and remove agentRunsPlugin registration):
```diff
diff --git a/apps/api/src/app.ts b/apps/api/src/app.ts
--- a/apps/api/src/app.ts
+++ b/apps/api/src/app.ts
@@
-  await app.register(agentRunsPlugin, { context, rateLimiterFactory });
+  // /runs handled in apps/api/src/server.ts
```

### P0-2: Replace stub `/citations` with Supabase-backed handler
Owner: Platform Engineering.
Evidence: `apps/api/src/routes/citations/index.ts` (stub response), `apps/api/src/routes/citations/data.ts` (static data), `apps/api/src/server.ts` (Supabase-backed `/citations`).
Diff sketch:
```diff
diff --git a/apps/api/src/routes/citations/handler.ts b/apps/api/src/routes/citations/handler.ts
new file mode 100644
--- /dev/null
+++ b/apps/api/src/routes/citations/handler.ts
@@
+import type { AppContext } from '../../types/context.js';
+import { authorizeRequestWithGuards } from '../../http/authorization.js';
+
+export async function getCitations(ctx: AppContext, orgId: string, userId: string, request: any) {
+  await authorizeRequestWithGuards('citations:view', orgId, userId, request);
+  const { data, error } = await ctx.supabase
+    .from('sources')
+    .select('id, title, source_type, jurisdiction_code, source_url, publisher, binding_lang, consolidated, language_note, effective_date, created_at, capture_sha256')
+    .eq('org_id', orgId)
+    .order('created_at', { ascending: false })
+    .limit(50);
+  if (error) throw new Error(error.message);
+  return {
+    entries: (data ?? []).map((row) => ({
+      id: row.id,
+      title: row.title,
+      sourceType: row.source_type,
+      jurisdiction: row.jurisdiction_code,
+      url: row.source_url,
+      publisher: row.publisher,
+      bindingLanguage: row.binding_lang,
+      consolidated: row.consolidated,
+      languageNote: row.language_note,
+      effectiveDate: row.effective_date,
+      capturedAt: row.created_at,
+      checksum: row.capture_sha256,
+    })),
+  };
+}
diff --git a/apps/api/src/routes/citations/index.ts b/apps/api/src/routes/citations/index.ts
--- a/apps/api/src/routes/citations/index.ts
+++ b/apps/api/src/routes/citations/index.ts
@@
-import { cloneCitationsData } from './data.js';
+import { getCitations } from './handler.js';
@@
-  app.get('/citations', async () => cloneCitationsData());
+  app.get('/citations', async (request) => {
+    const orgId = String((request.query as any)?.orgId ?? '');
+    const userId = String(request.headers['x-user-id'] ?? '');
+    return getCitations(_ctx, orgId, userId, request);
+  });
```

### P0-3: Fix `/corpus` stub to use existing Supabase logic
Owner: Platform Engineering.
Evidence: `apps/api/src/routes/corpus/index.ts` (calls undefined `cloneCorpusDashboardResponse`), `apps/api/src/routes/corpus/data.ts` (Supabase-backed `fetchCorpusDashboard`).
Diff sketch:
```diff
diff --git a/apps/api/src/routes/corpus/index.ts b/apps/api/src/routes/corpus/index.ts
--- a/apps/api/src/routes/corpus/index.ts
+++ b/apps/api/src/routes/corpus/index.ts
@@
 export async function registerCorpusRoutes(app: AppFastifyInstance, _ctx: AppContext) {
-  app.get('/corpus', async () => cloneCorpusDashboardResponse());
+  app.get('/corpus', async (request) => {
+    const orgId = String((request.query as any)?.orgId ?? '');
+    return fetchCorpusDashboard(_ctx.supabase, orgId);
+  });
 }
```

### P0-4: Replace stub `/hitl` routes with Supabase-backed handlers
Owner: Platform Engineering.
Evidence: `apps/api/src/routes/hitl/index.ts` (stub queue + action), `apps/api/src/server.ts` (real `/hitl`, `/hitl/:id`, `/hitl/metrics`).
Diff sketch:
```diff
diff --git a/apps/api/src/routes/hitl/handler.ts b/apps/api/src/routes/hitl/handler.ts
new file mode 100644
--- /dev/null
+++ b/apps/api/src/routes/hitl/handler.ts
@@
+// Extract existing logic from apps/api/src/server.ts (/hitl, /hitl/:id, /hitl/metrics)
+export async function getHitlQueue(ctx: unknown, request: unknown) {
+  throw new Error('move_hitl_queue_handler_from_server_ts');
+}
+export async function getHitlDetail(ctx: unknown, request: unknown) {
+  throw new Error('move_hitl_detail_handler_from_server_ts');
+}
+export async function getHitlMetrics(ctx: unknown, request: unknown) {
+  throw new Error('move_hitl_metrics_handler_from_server_ts');
+}
+export async function actOnHitl(ctx: unknown, request: unknown, input: unknown) {
+  throw new Error('move_hitl_action_handler_from_server_ts');
+}
diff --git a/apps/api/src/routes/hitl/index.ts b/apps/api/src/routes/hitl/index.ts
--- a/apps/api/src/routes/hitl/index.ts
+++ b/apps/api/src/routes/hitl/index.ts
@@
-import { cloneHitlQueueData } from './data.js';
+import { getHitlQueue, getHitlDetail, getHitlMetrics, actOnHitl } from './handler.js';
@@
-  app.get('/hitl', async () => cloneHitlQueueData());
+  app.get('/hitl', async (request) => getHitlQueue(_ctx, request));
+  app.get('/hitl/metrics', async (request) => getHitlMetrics(_ctx, request));
+  app.get('/hitl/:id', async (request) => getHitlDetail(_ctx, request));
-  app.post<{ Params: { id: string } }>('/hitl/:id', async (request, reply) => {
-    const parsed = hitlActionSchema.safeParse(request.body ?? {});
-    if (!parsed.success) {
-      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
-    }
-    return {
-      id: request.params.id,
-      action: parsed.data.action,
-      processedAt: new Date().toISOString(),
-    };
-  });
+  app.post<{ Params: { id: string } }>('/hitl/:id', async (request, reply) => {
+    const parsed = hitlActionSchema.safeParse(request.body ?? {});
+    if (!parsed.success) {
+      return reply.code(400).send({ error: 'invalid_request', details: parsed.error.flatten() });
+    }
+    return actOnHitl(_ctx, request, parsed.data);
+  });
```

## Phase 1 — Core Agent SDK Consolidation

### P1-1: Extract legal agent core into `packages/agent-kernel`
Owner: Intelligence Squad.
Evidence: `apps/api/src/agent.ts` (Agent SDK usage, tools, instructions), `packages/agent-kernel/src/orchestrator.ts` (existing Agents SDK usage for finance).
Diff sketch:
```diff
diff --git a/packages/agent-kernel/src/legal-agent.ts b/packages/agent-kernel/src/legal-agent.ts
new file mode 100644
--- /dev/null
+++ b/packages/agent-kernel/src/legal-agent.ts
@@
+// Move buildInstructions, buildAgent, and tool definitions from apps/api/src/agent.ts
+export function buildLegalAgent(): void {
+  throw new Error('move_build_agent_from_apps_api_agent_ts');
+}
+export function buildLegalInstructions(): void {
+  throw new Error('move_build_instructions_from_apps_api_agent_ts');
+}
diff --git a/packages/agent-kernel/src/index.ts b/packages/agent-kernel/src/index.ts
--- a/packages/agent-kernel/src/index.ts
+++ b/packages/agent-kernel/src/index.ts
@@
 export { FinanceAgentKernel } from './orchestrator.js';
+export { buildLegalAgent, buildLegalInstructions } from './legal-agent.js';
diff --git a/apps/api/src/agent.ts b/apps/api/src/agent.ts
--- a/apps/api/src/agent.ts
+++ b/apps/api/src/agent.ts
@@
+// remove local buildAgent implementation after moving to @avocat-ai/agent-kernel
+import { buildLegalAgent } from '@avocat-ai/agent-kernel';
+// replace local buildAgent with shared buildLegalAgent
```

### P1-2: Ensure shared kernel is the only path for `runLegalAgent`
Owner: Intelligence Squad.
Evidence: `apps/api/src/agent-wrapper.ts` (dynamic import of `./agent.js`), `apps/api/src/agent.ts` (runLegalAgent implementation).
Diff sketch:
```diff
diff --git a/apps/api/src/agent-wrapper.ts b/apps/api/src/agent-wrapper.ts
--- a/apps/api/src/agent-wrapper.ts
+++ b/apps/api/src/agent-wrapper.ts
@@
-  const mod = (await (importer as any)('./agent.js')) as { runLegalAgent: Function };
+  const mod = (await (importer as any)('@avocat-ai/agent-kernel')) as { runLegalAgent: Function };
```

## Phase 2 — MCP Server Tool Set

### P2-1: Add shared MCP tool schemas for legal tools
Owner: Intelligence Squad.
Evidence: `packages/shared/src/orchestrator-mcp.ts` (MCP schema pattern), `docs/SUPABASE_AND_AGENT_MANIFEST.yaml` (agent_tools list).
Diff sketch:
```diff
diff --git a/packages/shared/src/legal-mcp.ts b/packages/shared/src/legal-mcp.ts
new file mode 100644
--- /dev/null
+++ b/packages/shared/src/legal-mcp.ts
@@
+import { z } from 'zod';
+export const draftContractSchema = z.object({ prompt: z.string(), jurisdiction: z.string().optional() });
+export const analyzeClauseSchema = z.object({ base_text: z.string(), proposed_text: z.string(), jurisdiction: z.string().optional() });
+export const extractObligationsSchema = z.object({ text: z.string() });
+export const summarizeSchema = z.object({ text: z.string(), jurisdiction: z.string().optional() });
+export const compareVersionsSchema = z.object({ base_text: z.string(), proposed_text: z.string() });
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@
 export * from './akoma.js';
+export * from './legal-mcp.js';
```

### P2-2: Implement MCP server endpoints using existing tool logic
Owner: Intelligence Squad.
Evidence: `apps/api/src/agent.ts` (tools: redline_contract, generate_pleading_template, validate_citation), `apps/api/src/summarization.ts` (summarize pipeline), `packages/shared/src/orchestrator-mcp.ts` (MCP schema patterns).
Diff sketch (new app skeleton; location to confirm before implementation):
```diff
diff --git a/apps/mcp/src/server.ts b/apps/mcp/src/server.ts
new file mode 100644
--- /dev/null
+++ b/apps/mcp/src/server.ts
@@
+// MCP server stub that dispatches to legal tools (draft_contract, analyze_clause, extract_obligations, summarize, compare_versions)
+// Wire to shared kernel + summarization utilities from apps/api/src/summarization.ts
```

## Phase 3 — ChatGPT App UI Cards

### P3-1: Clause risk highlights card
Owner: Experience Squad.
Evidence: `apps/web/src/components/research/research-view.tsx` (IRAC render), `apps/web/src/components/risk-banner.tsx` (risk fields).
Diff sketch:
```diff
diff --git a/apps/web/src/components/research/clause-risk-card.tsx b/apps/web/src/components/research/clause-risk-card.tsx
new file mode 100644
--- /dev/null
+++ b/apps/web/src/components/research/clause-risk-card.tsx
@@
+import type { IRACPayload } from '@avocat-ai/shared';
+import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
+
+export function ClauseRiskCard({ risk }: { risk: IRACPayload['risk'] }) {
+  return (
+    <Card className="glass-card border border-slate-800/60">
+      <CardHeader>
+        <CardTitle className="text-slate-100">Clause risk highlights</CardTitle>
+      </CardHeader>
+      <CardContent className="space-y-2 text-sm text-slate-300">
+        <p>Niveau: {risk.level}</p>
+        <p>{risk.why}</p>
+      </CardContent>
+    </Card>
+  );
+}
diff --git a/apps/web/src/components/research/research-view.tsx b/apps/web/src/components/research/research-view.tsx
--- a/apps/web/src/components/research/research-view.tsx
+++ b/apps/web/src/components/research/research-view.tsx
@@
+import { ClauseRiskCard } from './clause-risk-card';
@@
+{payload?.risk ? <ClauseRiskCard risk={payload.risk} /> : null}
```

### P3-2: Obligations checklist card (schema + UI)
Owner: Experience Squad (UI) + Intelligence Squad (schema/prompt).
Evidence: `packages/shared/src/irac.ts` (IRAC schema), `apps/api/src/agent.ts` (instructions), `apps/web/src/components/research/research-view.tsx` (IRAC rendering).
Diff sketch:
```diff
diff --git a/packages/shared/src/irac.ts b/packages/shared/src/irac.ts
--- a/packages/shared/src/irac.ts
+++ b/packages/shared/src/irac.ts
@@
   risk: z.object({
     level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
     why: z.string(),
     hitl_required: z.boolean(),
   }),
+  obligations: z.array(z.string()).default([]),
 });
diff --git a/apps/api/src/agent.ts b/apps/api/src/agent.ts
--- a/apps/api/src/agent.ts
+++ b/apps/api/src/agent.ts
@@
-    'Produis toujours une analyse IRAC complète avec citations officielles et précise le statut linguistique.',
+    'Produis toujours une analyse IRAC complète avec citations officielles et précise le statut linguistique.',
+    "Ajoute une liste d'obligations clés (checklist) lorsque la question porte sur des clauses ou contrats.",
diff --git a/apps/web/src/components/research/obligations-card.tsx b/apps/web/src/components/research/obligations-card.tsx
new file mode 100644
--- /dev/null
+++ b/apps/web/src/components/research/obligations-card.tsx
@@
+import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
+
+export function ObligationsCard({ items }: { items: string[] }) {
+  return (
+    <Card className="glass-card border border-slate-800/60">
+      <CardHeader>
+        <CardTitle className="text-slate-100">Obligations checklist</CardTitle>
+      </CardHeader>
+      <CardContent className="space-y-2 text-sm text-slate-300">
+        {items.map((item) => (
+          <div key={item} className="flex items-start gap-2">
+            <span aria-hidden>•</span>
+            <span>{item}</span>
+          </div>
+        ))}
+      </CardContent>
+    </Card>
+  );
+}
diff --git a/apps/web/src/components/research/research-view.tsx b/apps/web/src/components/research/research-view.tsx
--- a/apps/web/src/components/research/research-view.tsx
+++ b/apps/web/src/components/research/research-view.tsx
@@
+import { ObligationsCard } from './obligations-card';
@@
+{payload?.obligations?.length ? <ObligationsCard items={payload.obligations} /> : null}
```

### P3-3: Suggested edits card (diff view)
Owner: Experience Squad + Intelligence Squad.
Evidence: `apps/web/src/components/drafting/redline-diff.tsx` (diff UI), `apps/api/src/agent.ts` (redline_contract tool).
Diff sketch:
```diff
diff --git a/apps/web/src/components/drafting/drafting-view.tsx b/apps/web/src/components/drafting/drafting-view.tsx
--- a/apps/web/src/components/drafting/drafting-view.tsx
+++ b/apps/web/src/components/drafting/drafting-view.tsx
@@
+import { RedlineDiff } from './redline-diff';
@@
+<RedlineDiff entries={redlineEntriesFromApi} messages={messages.drafting.redlineViewer} />
diff --git a/apps/web/src/lib/api.ts b/apps/web/src/lib/api.ts
--- a/apps/web/src/lib/api.ts
+++ b/apps/web/src/lib/api.ts
@@
+export async function compareVersions(input: { baseText: string; proposedText: string; orgId: string }) {
+  const response = await fetch(`${API_BASE}/drafting/compare`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
+  if (!response.ok) throw new Error('Unable to compare versions');
+  return response.json();
+}
diff --git a/apps/api/src/routes/drafting/index.ts b/apps/api/src/routes/drafting/index.ts
new file mode 100644
--- /dev/null
+++ b/apps/api/src/routes/drafting/index.ts
@@
+// Implement /drafting/compare using redline_contract logic from apps/api/src/agent.ts
```

## Phase 4 — Eval Golden Sets + Latency Budgets

### P4-1: Extend evaluation harness to cover obligations and diff outputs
Owner: Ops Squad + Intelligence Squad.
Evidence: `apps/ops/src/evaluate.ts` (benchmark workflow), `apps/ops/fixtures/benchmarks/*.json` (golden sets), `apps/ops/src/lib/evaluation.ts` (haystack composition).
Diff sketch:
```diff
diff --git a/apps/ops/fixtures/benchmarks/legalbench.json b/apps/ops/fixtures/benchmarks/legalbench.json
--- a/apps/ops/fixtures/benchmarks/legalbench.json
+++ b/apps/ops/fixtures/benchmarks/legalbench.json
@@
+  {
+    "id": "contract-obligations",
+    "name": "Contract obligations checklist",
+    "prompt": "Identifie les obligations clés d'une clause de non-concurrence.",
+    "expected_contains": ["obligations", "non-concurrence"]
+  }
diff --git a/apps/ops/src/lib/evaluation.ts b/apps/ops/src/lib/evaluation.ts
--- a/apps/ops/src/lib/evaluation.ts
+++ b/apps/ops/src/lib/evaluation.ts
@@
   segments.push(payload.risk.level);
   segments.push(payload.risk.why);
+  if (Array.isArray((payload as any).obligations)) {
+    segments.push(...(payload as any).obligations);
+  }
```

### P4-2: Add explicit latency budgets to shared thresholds and enforce via SLO CLI
Owner: Ops Squad.
Evidence: `packages/shared/src/constants/thresholds.ts` (acceptance thresholds), `apps/ops/src/slo-report.ts` (SLO CLI).
Diff sketch:
```diff
diff --git a/packages/shared/src/constants/thresholds.ts b/packages/shared/src/constants/thresholds.ts
--- a/packages/shared/src/constants/thresholds.ts
+++ b/packages/shared/src/constants/thresholds.ts
@@
 export interface AcceptanceThresholds {
   citationsAllowlistedP95: number;
   temporalValidityP95: number;
   maghrebBindingBannerCoverage: number;
   linkHealthFailureRatioMax: number;
   hitlRecallHighRisk: number;
+  retrievalLatencyP95Seconds?: number;
+  hitlResponseP95Seconds?: number;
 }
diff --git a/apps/ops/src/slo-report.ts b/apps/ops/src/slo-report.ts
--- a/apps/ops/src/slo-report.ts
+++ b/apps/ops/src/slo-report.ts
@@
+  // After creating snapshot, compare against thresholds and exit non-zero if exceeded.
```

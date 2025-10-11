# Architecture Blueprint (Stage 1)

_Draft – 2025‑02‑07_

This document captures the target architecture that the refactor will move us toward. It is intentionally high-level; individual stages will contain detailed task lists and acceptance criteria.

## 1. Layered Overview

```
┌────────────────────────────────────────────────────────────────┐
│ Web Clients (Next.js App Router, PWA shell, Storybook)          │
│   • Feature modules: workspace, research, matters, drafting,    │
│     citations, trust, admin                                     │
│   • Shared packages: ui primitives, hooks, analytics            │
├────────────────────────────────────────────────────────────────┤
│ API Gateway (Fastify)                                           │
│   • Domain modules (planned):                                   │
│       auth, workspace, research, drafting, hitl, trust, admin   │
│   • Shared services: supabase client, openai client, config     │
│   • Validation: zod schemas + typed responses                   │
├────────────────────────────────────────────────────────────────┤
│ Edge / Workers (Deno)                                           │
│   • Crawlers, learning, regulators, transparency, drive ingest  │
│   • Shared libs: supabase helper, allowlist, akoma parser,      │
│     openai client                                               │
├────────────────────────────────────────────────────────────────┤
│ Data + Infrastructure                                           │
│   • Supabase Postgres + storage                                 │
│   • Supabase functions/RPC + migrations                         │
│   • Observability: Grafana/Datadog dashboards + alerts          │
└────────────────────────────────────────────────────────────────┘
```

## 2. Module Boundaries (Target)

| Layer        | Modules / Packages                      | Notes / Owners (initial)                        |
| ------------ | --------------------------------------- | ----------------------------------------------- |
| Web          | `apps/web` feature folders              | Frontend squad                                  |
| Shared UI    | `apps/web/src/components/ui`            | Frontend + Design                               |
| Shared logic | `packages/shared`, `packages/supabase`  | Platform squad                                  |
| API          | `apps/api/src/domain/*` (to be created) | Platform squad                                  |
| Edge         | `apps/edge/*`                           | Platform (crawlers), Ops (learning/regulators)  |
| Ops          | `apps/ops`                              | Ops team                                        |

Each module should export a narrow public API. Cross-module calls go via shared packages, not direct file imports.

## 3. Planned Work Breakdown

1. **Stage 1 (DX Foundations – _current_)**
   - Document architecture & tooling.
   - Enforce repo-wide lint/type/test.
   - Introduce Storybook + bundle/Lighthouse scripts (optional for now).
2. **Stage 2 (Backend / Edge decomposition)**
   - Split Fastify server into domain routers + services.
   - Move shared logic into `packages/shared` + Deno-friendly libs.
   - Add contract tests & typed Supabase wrappers.
3. **Stage 3 (Frontend feature modules & PWA)**
   - Extract Next.js pages into modular directories.
   - Integrate design tokens, accessibility, offline/push.
4. **Stage 4+ (Data hardening, observability, documentation)**
   - Consolidate migrations, add alerts, update runbooks.

## 4. Hotspots & Risks

| Area                         | Current Issue                                   | Mitigation (Stage)                     |
| --------------------------- | ----------------------------------------------- | -------------------------------------- |
| `apps/api/src/server.ts`    | >5k LOC monolith                                 | Stage 2: extract domain routers        |
| Edge workers                | Repeated Supabase/OpenAI wiring                 | Stage 2: shared Deno libs              |
| Web workspace/research view | Complex components, offline behaviour tied here | Stage 3: feature modules + hooks       |
| Supabase migrations         | Manual scripts, no rollback automation          | Stage 4: migration CLI + docs          |
| Observability               | Alerts undocumented                             | Stage 5: monitoring doc + alert rules  |

## 5. RACI Snapshot

| Deliverable                  | Responsible | Accountable | Consulted     | Informed        |
| ---------------------------- | ----------- | ----------- | ------------- | --------------- |
| Architecture blueprint       | Platform    | CTO         | Frontend, Ops | All engineers   |
| Toolchain harmonisation      | Platform    | Platform    | Frontend, Ops | All engineers   |
| API domain extraction        | Platform    | Platform    | Ops           | Frontend, Execs |
| Edge shared libs             | Platform    | Platform    | Ops           | Frontend        |
| Frontend module refactor     | Frontend    | Frontend    | Platform      | Ops, Execs      |

## 6. Next Steps

- Finalise Stage 1 DX doc.
- Create tickets for Stage 2 (API domain split, shared Deno libs).
- Keep this document updated after each milestone.


# Backend Refactor Progress (Phase 3)

_Updated: 2025-02-07_

## Goals
- Shrink the monolithic `apps/api/src/server.ts` into smaller, testable modules.
- Centralise HTTP helpers (auth guards, schemas) for reuse across route handlers.
- Establish a pattern for route registration and dependency injection to ease future moves.

## Current Changes
1. **HTTP helpers extracted**
   - `authorizeRequestWithGuards` now lives in `src/http/authorization.ts`, decoupling request-level compliance checks from the server bootstrap.
   - Chat session schemas relocated to `src/http/schemas/chatkit.ts`.
2. **Route modularisation**
   - All ChatKit endpoints are registered through `registerChatkitRoutes` (`src/http/routes/chatkit.ts`).
   - Orchestrator command/connector/job endpoints now live in `registerOrchestratorRoutes` (`src/http/routes/orchestrator.ts`) with shared Zod schemas under `http/schemas`.
   - `server.ts` simply wires the Fastify instance and delegates route binding.
3. **Configuration hygiene**
   - Shared TypeScript config split (`tsconfig.node.json`) while packages own their `rootDir/outDir`.
   - Added `typecheck` scripts across packages and documented tooling expectations (`docs/refactor/tooling-standards.md`).

## Next Steps
- Finish migrating governance and metrics/reporting routes into dedicated modules.
- Introduce an application assembler (`createApp()` factory) to separate bootstrapping from runtime execution.
- Add route-level tests for the new ChatKit and orchestrator modules and migrate existing suites to the modular structure.
- Address legacy type errors surfaced by `tsc --noEmit` (requires separate env/key typing work).

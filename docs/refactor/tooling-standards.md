# Tooling & Standards Playbook

_Phase 2 deliverable • Updated 2025-02-07_

## Supported Toolchain
- **Node**: 20.x (minimum)  
- **Package manager**: `pnpm@8.15.4` (pinned via `package.json#packageManager`)  
- **TypeScript**: 5.4.x across all packages (shared via `@avocat-ai/tsconfig` presets)
- **Testing**: `vitest` for unit/integration, `cypress` for PWA E2E  
- **Linting**: ESLint 8.57 with shared config (`packages/config/eslint/node.cjs`) and Next.js defaults for web surfaces  
- **Formatting**: Rely on ESLint + project conventions (Prettier optional; re-evaluate once formatting rules consolidated)

## Workspace Scripts
- `pnpm lint` — runs package-scoped lint commands (now powered by shared config)  
- `pnpm typecheck` — executes `tsc --noEmit` in every workspace (new)  
- `pnpm test` — invokes `vitest run` or package-specific suites across the repo
- CI runs `pnpm lint`, `pnpm typecheck`, and `pnpm test` so regressions fail before merge.
- Edge workers live under `@apps/edge`; `pnpm` scripts invoke `deno lint` / `deno check` via `deno.jsonc` (Deno 1.43+ required on CI developers machines).

Teams should prefer the workspace scripts above when gating CI or local commits. Individual package scripts remain available for focused iteration.

## TypeScript Configuration
- `@avocat-ai/tsconfig/node.json` standardises compiler options (`outDir`, `rootDir`, declarations, composite) for all Node-based services and libraries.
- Each package-specific `tsconfig.json` **only** declares includes/excludes, reducing duplication.
- Next.js apps extend `@avocat-ai/tsconfig/next.json`, adding local includes or overrides sparingly.

## ESLint Configuration
- `@avocat-ai/eslint-config/node` exports the canonical Node/TypeScript config.
- Server and library packages (`apps/api`, `apps/ops`, `packages/*`) consume it via `.eslintrc.cjs`, ensuring identical rules and ignore patterns.
- Web surfaces extend `@avocat-ai/eslint-config/next`, layering Next.js defaults with shared rules.

### Adding a New Package
1. Create `tsconfig.json` extending `@avocat-ai/tsconfig/node.json` (or the appropriate Next preset).
2. Add `lint`, `typecheck`, and `test` scripts to `package.json`.  
3. Consume the shared ESLint factory:  
   ```js
   // .eslintrc.cjs
   const path = require('node:path');
   const createNodeConfig = require('@avocat-ai/eslint-config/node');
   module.exports = createNodeConfig({ tsconfigPath: path.join(__dirname, 'tsconfig.json') });
   ```
4. Verify `pnpm lint`, `pnpm typecheck`, and `pnpm test` succeed from the repo root.

## Coding Conventions (Snapshot)
- Prefer strict TypeScript (enabled globally). Avoid `any`; escalate to utility types in `@avocat-ai/shared` when reuse emerges.  
- Keep modules under 400 lines where possible; extract domain services/helpers rather than expanding mega-modules.  
- Co-locate tests beside source (e.g., `src/foo.test.ts`) or under dedicated `test/` directories; ensure `tsconfig` includes them.  
- Surface shared constants/types in `@avocat-ai/shared` instead of duplicating per app.  
- Document complex workflows or scripts in `docs/refactor/` (this playbook is the living source of tooling truth).

## Next Steps
- Vendor Deno edge worker dependencies or pin cache snapshots so `deno check` remains reproducible offline.  
- Evaluate Prettier or ESLint formatting rules for consistent style enforcement.

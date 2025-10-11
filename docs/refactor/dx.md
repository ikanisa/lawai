# Developer Experience Guidelines (Stage 1)

_Last updated: 2025‑02‑07_

## Toolchain

- **Node**: 20.x (see `.nvmrc` or Volta config). Use `nvm use` or `corepack` to match CI.
- **Package manager**: `pnpm@8.15.4` (pinned in `package.json`).
- **Global setup**:
  ```bash
  nvm use            # or `corepack enable` if using Corepack
  pnpm install
  ```
- **Repo entrypoints**:
  - `pnpm lint` – eslint for all packages/apps.
  - `pnpm typecheck` – `tsc --noEmit` across the monorepo.
  - `pnpm test` – vitest suites.
  - `pnpm --filter @apps/edge ...` – specific edge commands; Deno lint/typecheck run from CI (`apps/edge/scripts/typecheck.ts`).

## Pre-commit (optional, recommended)

If you want local hooks, install [lefthook](https://github.com/evilmartians/lefthook):

```bash
pnpm dlx lefthook install
```

Then configure `.lefthook.yml` to run `pnpm lint --filter …` or formatting commands as needed.

## Formatting & Linting

- ESLint handles both code quality and formatting quirks. Run `pnpm lint --fix` to auto-resolve trivial issues.
- Prettier is not enforced yet; re-evaluate once Stage 3 settles shared UI patterns.

## Storybook / Design System _(planned)_

- Stage 1 sets up documentation; Stage 3 will introduce Storybook for UI contracts.
- For now, use `apps/web/src/components/ui` patterns and document shared components in `.mdx` files when appropriate.

## Bundle / Performance Analysis

- Run `pnpm build` regularly; `next build` prints bundle stats.
- For deeper analysis:
  ```bash
  pnpm dlx nextjs-bundle-analyzer
  pnpm dlx lighthouse http://localhost:3000 --output html --chrome-flags="--headless"
  ```
  Store reports in `docs/refactor/baseline/` for comparison.

## IDE Recommendations

`.vscode/extensions.json` lists suggested VS Code extensions (ESLint, PNPM, Tailwind, etc.). Install them for the best DX.

---

Update this doc whenever tooling or processes change during the refactor.

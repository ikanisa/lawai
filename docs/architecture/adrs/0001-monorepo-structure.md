# ADR 0001: Adopt pnpm workspace monorepo

- **Status:** Accepted (2025-02-12)
- **Context:** We manage API services, Next.js front-ends, Deno edge functions, and shared packages that must release in lockstep. Previous multi-repo setup caused dependency skew and duplicated infrastructure automation.
- **Decision:** Consolidate into a single pnpm workspace monorepo with shared TypeScript configuration, linting presets, and environment validation helpers.
- **Consequences:**
  - ✅ Cross-package refactors ship atomically with a single PR and Vercel deployment pipeline.
  - ✅ Shared tooling (Vitest, ESLint, Supabase migrations) runs from the root `Makefile`.
  - ⚠️ Requires strict adherence to pnpm (`npm`/`yarn` blocked via preinstall script).
  - ⚠️ Larger install footprint; contributors should enable pnpm caching in CI.

See [`../../README.md`](../../README.md) for the updated quickstart and per-app guides.

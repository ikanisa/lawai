# Vercel Deployment Plan

## Monorepo overview
- **Root directory:** `/` (pnpm workspaces)
- **Package manager:** pnpm 8.15.4 (respect `pnpm-lock.yaml`)
- **Node runtime:** 20.x (`.nvmrc` pins 20.11.0, engines `>=20 <21`)
- **Install command:** `pnpm install --frozen-lockfile`
- **Corepack:** enable pnpm via `corepack prepare pnpm@8.15.4 --activate`

## Apps

### @avocat-ai/web (Next.js)
- **Vercel project:** `apps/web`
- **rootDirectory:** `apps/web`
- **framework:** Next.js 14 (App Router + custom PWA scripts)
- **installCommand:** `pnpm install --frozen-lockfile`
  - Needs workspace hoisting for shared packages.
- **buildCommand:** `pnpm --filter @avocat-ai/web build`
- **outputDirectory:** `.next`
- **nodeVersion:** 20.x
- **env requirements:** see `apps/web/.env.example`
- **notes:**
  - `next.config.js` exports `output: 'standalone'` for Vercel serverless.
  - Service worker preparation runs via npm script (prebuild hook). Ensure `PUBLIC_URL` not required.

### @apps/api (Fastify)
- **rootDirectory:** `apps/api`
- **framework preset:** `other`
- **installCommand:** `pnpm install --frozen-lockfile`
- **buildCommand:** `pnpm --filter @apps/api build`
- **outputDirectory:** `dist`
- **deployment target:** Vercel Serverless Functions (Node 20)
- **notes:**
  - Requires environment variables validated in `apps/api/src/env.server.ts`.
  - Consider Vercel Edge Config only for static assets (not part of this audit).
  - Use `vercel.json` (root) rewrites if API shared with Next frontend.

### @apps/ops (CLI / workers)
- **rootDirectory:** `apps/ops`
- **deployment target:** Not deployed to Vercel. Run via CI / cron.
- **notes:** Provide `.env.example` and validation for local + CI usage.

### @apps/pwa (Next.js demo)
- **rootDirectory:** `apps/pwa`
- **notes:** Secondary app, not configured for automated deploy yet. Follow same pattern as `@avocat-ai/web` when promoted.

### @apps/edge (Deno)
- Not currently mapped to a Vercel project. Requires Vercel Edge Functions adapter when activated.

## Global configuration recommendations
- Add `apps/web/vercel.json` to pin build/route config for the primary Next.js project.
- Configure Vercel project to use root `package.json` (pnpm) with `rootDirectory=apps/web`.
- Provide CI job (`.github/workflows/vercel-preview-build.yml`) to mirror `vercel build` using Node 20.
- Enforce environment schema validation via app-specific `env` modules.
- Use `scripts/vercel-preflight.mjs` before releases to confirm environment parity.

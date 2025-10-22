# Deployment Plan

## Monorepo overview
- **Root directory:** `/` (npm workspaces)
- **Package manager:** npm 11.4.2 (respect `package-lock.json`)
- **Node runtime:** 20.x (`.nvmrc` pins 20.11.0, engines `>=20 <21`)
- **Install command:** `npm ci`
- **Corepack:** enabled automatically for npm >= 7

## Apps

### @avocat-ai/web (Next.js)
- **Hosting project:** `apps/web`
- **rootDirectory:** `apps/web`
- **framework:** Next.js 14 (App Router + custom PWA scripts)
- **installCommand:** `npm install`
  - Needs workspace hoisting for shared packages.
- **buildCommand:** `npm run build --workspace @avocat-ai/web`
- **outputDirectory:** `.next`
- **nodeVersion:** 20.x
- **env requirements:** see `apps/web/.env.example`
- **notes:**
  - `next.config.js` exports `output: 'standalone'` for serverless runtimes.
  - Service worker preparation runs via npm script (prebuild hook). Ensure `PUBLIC_URL` not required.

### @apps/api (Fastify)
- **rootDirectory:** `apps/api`
- **framework preset:** `other`
- **installCommand:** `npm install`
- **buildCommand:** `npm run build --workspace @apps/api`
- **outputDirectory:** `dist`
- **deployment target:** Serverless functions (Node 20)
- **notes:**
  - Requires environment variables validated in `apps/api/src/env.server.ts`.
  - Configure edge key-value store only for static assets (not part of this audit).
  - Use platform rewrites if API shared with Next frontend.

### @apps/ops (CLI / workers)
- **rootDirectory:** `apps/ops`
- **deployment target:** Not deployed to hosting provider. Run via CI / cron.
- **notes:** Provide `.env.example` and validation for local + CI usage.

### @apps/pwa (Next.js demo)
- **rootDirectory:** `apps/pwa`
- **notes:** Secondary app, not configured for automated deploy yet. Follow same pattern as `@avocat-ai/web` when promoted.

### @apps/edge (Deno)
- Not currently mapped to a hosting project. Requires edge functions adapter when activated.

## Global configuration recommendations
- Add platform routing config for the primary Next.js project (see `apps/web/deployment.config.json`).
- Configure hosting project to use root `package.json` (npm) with `rootDirectory=apps/web`.
- Provide CI job (`.github/workflows/preview-build.yml`) to mirror production builds using Node 20.
- Enforce environment schema validation via app-specific `env` modules.
- Use `scripts/deployment-preflight.mjs` before releases to confirm environment parity.

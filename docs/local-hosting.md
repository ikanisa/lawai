# Local Hosting Guide (macOS)

This guide walks through running the Avocat-AI Francophone stack entirely on a MacBook for offline validation and Supabase-backed development.

## Prerequisites

- macOS 13 or newer
- Homebrew for installing Node.js and Postgres tooling (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`)
- Node.js 20 LTS (install via `brew install node@20` or `nvm install 20`)
- pnpm ≥ 8.15 (`corepack enable && corepack prepare pnpm@latest --activate`)
- Access to the Supabase project used by the stack (service role + anon keys)

## Environment configuration

1. Copy the example environment into a local-only file:
   ```bash
   cp .env.example .env.local
   ```
2. Edit `.env.local` and supply your Supabase credentials:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Fill in required OpenAI keys (`OPENAI_API_KEY`, `OPENAI_VECTOR_STORE_AUTHORITIES_ID`, etc.). Leave optional sections blank if not used locally.
4. For app-specific services (`apps/api`, `apps/web`, `apps/ops`), copy their `.env.example` files to `.env.local` alongside each app when custom overrides are needed.

## Install dependencies

From the repository root:
```bash
pnpm install
```

## Build the workspace

Generate all build artefacts (TypeScript compilation, Next.js build, shared packages):
```bash
pnpm build
```

If you need a faster iteration loop, run `pnpm dev:api` and `pnpm dev:web` in separate terminals instead of the full build.

## Start the services

The monorepo exposes a production-style start command that launches the API and web apps with the compiled output:
```bash
pnpm start
```

- The Fastify API listens on `http://localhost:3333`.
- The Next.js operator console renders on `http://localhost:3001`.

Confirm both services connect to Supabase by checking the console logs for successful authentication. If you see auth failures, re-validate the values in `.env.local` and the app-specific `.env.local` files.

## Supabase helpers

- Run `pnpm db:migrate` to apply the latest migrations to your Supabase project.
- Execute `pnpm --filter @apps/ops bootstrap` to seed required buckets and allowlists.
- Use `pnpm ops:foundation` for an end-to-end provisioning pass (buckets, vector stores, environment sanity checks).

## Optional: local job schedulers

While production previously relied on Vercel cron, local environments can either:

- Run `pnpm task:<name>` scripts on demand, or
- Follow the playbook in `scripts/cron.md` to schedule recurring tasks via `node-cron` or macOS `launchd`.

Keeping jobs local ensures you can validate ingestion, evaluations, and Drive watchers without any Vercel-specific tooling.

# Local Hosting Guide

This document explains how to run the Avocat-AI stack locally using the bundled Node server output. It assumes you already have a Supabase project with the required migrations applied.

## 1. Prerequisites

- Node.js 20 (matches the version declared in `package.json`).
- `pnpm` 8+ (Corepack recommended).
- A Supabase project with service role access and database URL.
- OpenAI API credentials.

## 2. Configure environment variables

1. Copy the provided examples:
   ```bash
   cp apps/web/.env.example apps/web/.env.local
   cp apps/ops/.env.example apps/ops/.env.local
   cp apps/api/.env.example apps/api/.env
   ```
2. Update the secrets:
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must reference your Supabase instance.
   - `OPENAI_API_KEY` should carry a key that can access the configured models.
   - `NEXT_PUBLIC_API_BASE_URL` **must remain** `http://localhost:3333` for local operation so the web client talks to the Fastify API.
   - `API_BASE_URL` in `apps/ops/.env.local` should stay `http://localhost:3333/api`.

> **Note:** The Supabase service role key is only read on the server. The client bundle never embeds it; requests flow through server actions and the Fastify API.

## 3. Install dependencies and build assets

Run the workspace installation and compile the production bundles once:
```bash
pnpm install
pnpm --filter @apps/api build
pnpm --filter @avocat-ai/web build
```

If you are bootstrapping a new database, apply the migrations and seed data:
```bash
pnpm db:migrate
pnpm seed
```

## 4. Launch the services

1. Start the API (Fastify) on port 3333:
   ```bash
   pnpm dev:api
   ```
   The server exposes `/api/healthz` and all agent orchestration routes backed by Supabase.

2. In a separate terminal, start the Next.js Node server on port 3000:
   ```bash
   PORT=3000 pnpm start
   ```
   The command runs `next start` against the standalone build created earlier.

3. Visit the operator console at <http://localhost:3000>. The web app proxies authenticated calls to the API running on port 3333.

## 5. Verify the PWA bundle

After the web server is running, confirm the PWA manifest is reachable:
```bash
curl http://localhost:3000/manifest.webmanifest
```
You should receive a JSON manifest describing the name, icons, and start URL of the application.

## 6. Worker & CLI tooling

CLI workflows (evaluations, SLO reports, transparency) use the same Supabase project and the `API_BASE_URL` pointing at `http://localhost:3333/api`. Run them via:
```bash
pnpm --filter @apps/ops <command>
```

Keep the `.env.local` files under version control ignore rules to avoid leaking secrets. When packaging for another environment, reuse the same values but provision secrets via your hosting platform's secret manager.

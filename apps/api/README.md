# API service (`@apps/api`)

Fastify-based orchestration layer that exposes REST endpoints, integrates with OpenAI Agents, and brokers Supabase persistence for the Avocat-AI platform.

## Prerequisites

- Node.js 20.x (managed via Volta or `nvm`)
- pnpm 8.15.4 (`corepack prepare pnpm@8.15.4 --activate`)
- Running Supabase instance (local or hosted) with `pgvector` and `pg_trgm`
- Populated `.env`/`.env.local` at the repo root (see [`../../.env.example`](../../.env.example))

## Install

```bash
pnpm install
pnpm db:migrate            # applies Postgres migrations
pnpm --filter @apps/ops run vectorstore
```

## Environment

Copy the service template and set the required secrets. Local development defaults to `.env.local` at the repo root plus overrides in `apps/api/.env.example`.

Key variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase connectivity |
| `OPENAI_API_KEY` | Agent and embedding requests |
| `AGENT_MODEL`, `EMBEDDING_MODEL` | Model selection knobs |
| `EDGE_SERVICE_SECRET` | Auth for callbacks originating from Supabase Edge |

Refer to [`../../docs/env-matrix.md`](../../docs/env-matrix.md) for the complete matrix.

## Development

```bash
pnpm dev:api               # starts Fastify on http://localhost:3333
```

Hot reload is provided by `tsx`. Requests log via pino and forward trace context when OpenTelemetry is enabled.

## Quality gates

```bash
pnpm --filter @apps/api run lint
pnpm --filter @apps/api run typecheck
pnpm --filter @apps/api run test
```

Vitest runs live by default. Use `OPENAI_API_KEY=stub` to exercise stubbed responses during CI or in air-gapped environments.

## Build & deploy

```bash
pnpm --filter @apps/api run build
```

The build step emits TypeScript artifacts to `dist/` for bundler consumption. Deploy using the `Dockerfile` in `infra/` or via the GitHub Actions workflow `Deploy` which runs the deployment preflight, migrations, and Vercel promotion hooks.

## Observability

- Exports traces and metrics via `@avocat-ai/observability`.
- Surface health checks at `/healthz` and `/readyz`.
- See the API dashboard in Grafana (`Observability › API Core SLOs`) referenced from [`../../docs/observability.md`](../../docs/observability.md).

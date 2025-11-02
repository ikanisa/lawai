# API clients (`@avocat-ai/api-clients`)

Typed SDKs for interacting with the Fastify API. Ships Zod-powered schemas for request/response validation.

## Install

```bash
pnpm install
```

Consumers import via pnpm workspace. External publishing is disabled; use workspace linking (`pnpm --filter @avocat-ai/api-clients ...`).

## Scripts

```bash
pnpm --filter @avocat-ai/api-clients run lint
pnpm --filter @avocat-ai/api-clients run typecheck
pnpm --filter @avocat-ai/api-clients run test
pnpm --filter @avocat-ai/api-clients run build
```

Build emits CommonJS/ESM compatible bundles into `dist/`.

## Usage

```ts
import { createCaseClient } from '@avocat-ai/api-clients';

const client = createCaseClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL!,
  apiKey: process.env.EDGE_SERVICE_SECRET!,
});

const response = await client.submitCase(payload);
```

## Observability alignment

Clients propagate `x-request-id` and `x-observability-tags` headers. Dashboards in [`../../docs/observability.md`](../../docs/observability.md) correlate client span IDs with API traces.

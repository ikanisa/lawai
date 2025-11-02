# Observability toolkit (`@avocat-ai/observability`)

Reusable OpenTelemetry bootstrapper shared across the API, Ops CLI, and background workers.

## Install

```bash
pnpm install
```

## Scripts

```bash
pnpm --filter @avocat-ai/observability run lint
pnpm --filter @avocat-ai/observability run typecheck
pnpm --filter @avocat-ai/observability run test
pnpm --filter @avocat-ai/observability run build
```

## Usage

```ts
import { createNodeSDK } from '@avocat-ai/observability';

const sdk = createNodeSDK({
  serviceName: 'api',
  serviceVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
});

await sdk.start();
```

The helper configures OTLP exporters using environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`). See [`../../docs/observability.md`](../../docs/observability.md) for the supported dashboards.

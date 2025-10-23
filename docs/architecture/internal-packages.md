# Internal Packages Overview

This document summarizes the shared packages that underpin the monorepo and how they should be consumed across applications.

## `@avocat-ai/api-clients`

The API client package exposes typed helpers for calling REST and agent endpoints exposed by the API service. Consumers construct a client by providing the API base URL (and optionally custom fetch/default headers):

```ts
import { createRestClient } from '@avocat-ai/api-clients';

const api = createRestClient({ baseUrl: process.env.API_BASE_URL! });
const { data } = await api.submitResearchQuestion({
  question: 'Summarize the latest OHADA filing',
  orgId: orgIdFromContext,
  userId: userIdFromSession,
});
```

All exported methods return typed responses and run-time validation via Zod. The package also exports convenience constants such as `DEMO_ORG_ID` for demo surfaces.

## `@avocat-ai/shared`

Shared domain models, constants, and helper utilities are grouped into dedicated entry points:

- `config` – configuration presets and permission matrices.
- `constants` – allowlists, jurisdiction catalogs, and scoring thresholds.
- `domain` – IRAC payload definitions, planning helpers, and orchestrator types.
- `utils` – client helpers for external integrations (OpenAI, Deno bindings, etc.).

Import only the surface you need to minimize bundle size.

## `@avocat-ai/supabase`

The Supabase package now ships generated database types and Zod validators under `src/generated/database.types.ts`. Types are derived from `supabase/schema.sql` via `npm run supabase:types`, and a vitest guard (`packages/supabase/test/schema-hash.test.ts`) fails fast when the schema hash changes without regenerating types. Runtime clients (`createServiceClient`) continue to live in the same package.

### Regenerating types

1. Apply migrations / update `supabase/schema.sql`.
2. Run `npm run supabase:types` from the repo root.
3. Commit the updated `src/generated/database.types.ts` file.
4. Ensure tests pass (`npm test` runs the schema hash guard).

Keeping the generated types in sync guarantees that backend schema changes surface immediately across web, API, and CLI consumers.

# Internal package guide

This repository now ships three reusable packages for shared business logic, Supabase access, and API integrations. Use this document as the single reference when wiring new features or upgrading dependencies.

## `@avocat-ai/shared`

* Exposes **domain models** (`domain/*`), **constants** (`constants/*`), and **utility helpers** (`utilities/*`).
* Imports can target the grouped entry points, e.g.:
  ```ts
  import { IRACPayload, ALLOWLISTED_HOSTS } from '@avocat-ai/shared';
  import { OpenAiClient } from '@avocat-ai/shared/utilities';
  ```
* The split exports remove the previous wildcard re-export and make tree-shaking deterministic.

## `@avocat-ai/supabase`

* Run `npm run supabase:types` after editing SQL to regenerate `Database` typings via the Supabase CLI (`scripts/generate-supabase-types.mjs`).
* Runtime validation lives in `validators.ts` – each table (e.g. `adminTables.jobs`) provides a Zod schema and strongly typed alias. Use them to guard boundary inputs.
* `createServiceClient` now returns a typed `SupabaseClient<Database>` so API handlers and edge functions get full IntelliSense.

## `@avocat-ai/sdk`

* `createRestClient({ baseUrl, defaultOrgId, defaultUserId })` centralises REST endpoints. Apps should call it once during bootstrap and then import the destructured helpers.
* `createAgentClient({ baseUrl })` wraps `/agents/run` and `/agents/stream`, including Research stream validation and abort handling.
* The package powers both the web app (`apps/web/src/lib/api.ts`) and ops CLI scripts (`apps/ops/src/*`) so behavior stays consistent across surfaces.

## Release management

* Changesets are enabled (`npm run changeset`) with version bumps tracked in `.changeset/`.
* Run `npm run release` locally to stage version bumps before publishing from CI.

Keeping these packages aligned prevents drift between the API, web, and operational tooling. Update this guide whenever a package gains new surface area or breaking changes.

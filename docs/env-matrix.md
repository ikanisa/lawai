# Environment variable matrix

This guide lists the canonical locations for environment variables across the
monorepo, the services that consume them, and the dashboards used to verify
their health. Shared credentials are validated through
`packages/shared/src/config/env.ts`, while each app-specific loader layers its
own requirements on top. Update this document whenever a new secret or
configuration knob is introduced and link the appropriate Grafana panel when it
impacts observability.

## Shared credentials (managed once)

| Variable(s) | Primary consumers | Source of truth | Observability linkage | Notes |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | API, Ops, Web server actions | Root `.env` (mirrored in examples) → parsed via `packages/shared/src/config/env.ts` | Grafana **Platform › Supabase latency** | Required for server-side Supabase interactions. Ops enforces non-empty values, API validates at runtime for production safety. |
| `SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Web UI, legacy bots | Root `.env` & `apps/web/.env.example` | Grafana **User Experience › Auth success rate** | Public anon key for browser clients. Keep in sync with Supabase project. |
| `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_MANAGEMENT_API_URL` | Ops CLI automation, legacy scripts | Root `.env` | Grafana **Automation › Provisioning health** | Optional but shared across automation tools. |
| `EDGE_SERVICE_SECRET`, `EDGE_JWT_SECRET` | Supabase Edge Functions, Ops scheduler, external cron runners | Root `.env` → Supabase secrets | Grafana **Edge Workers › Auth failures** | `EDGE_SERVICE_SECRET` powers the `X-Service-Secret` header; `EDGE_JWT_SECRET` signs optional HS256 bearer tokens. |
| `OPENAI_API_KEY`, `OPENAI_BASE_URL` | API, Ops workers, legacy bots | Root `.env` → shared helper | Grafana **OpenAI Request Health** | API and Ops enforce a value; helper allows overrides for non-OpenAI providers. |
| `OPENAI_VECTOR_STORE_AUTHORITIES_ID` | API (default `vs_test`), Ops (optional) | Root `.env` | Grafana **Automation › Vector sync freshness** | API defaults to `vs_test` but production deployments should override. |
| `OPENAI_REQUEST_TAGS*` (`OPENAI_REQUEST_TAGS`, `OPENAI_REQUEST_TAGS_API`, `OPENAI_REQUEST_TAGS_OPS`, `OPENAI_REQUEST_TAGS_EDGE`) | API, Ops, Edge workers | Root `.env` | All dashboards – used as filters | Shared tagging conventions for observability. |

## Optional integrations

| Variable group | Primary consumers | Source of truth | Notes |
| --- | --- | --- | --- |
| `OPENAI_CHATKIT_*` | API | Root `.env` | Enables chatkit session creation when configured. |
| `OPENAI_ORGANIZATION`, `OPENAI_PROJECT`, `OPENAI_DEBUG_REQUESTS` | API, Ops | Root `.env` | Optional knobs for request routing and verbose logging when diagnosing OpenAI traffic. |
| `JURIS_ALLOWLIST_JSON` | API, legacy bots | Root `.env` | Optional JSON array overriding jurisdiction allowlist. |
| `WA_*` (WhatsApp OTP) | API, Francophone Lex | Root `.env` (with per-app overrides) | Leave unset to disable WhatsApp. Provide full set (`WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_TEMPLATE_*`, `WA_PROVIDER`) to enable. |
| `C2PA_SIGNING_*` | API, Francophone Lex | Root `.env` | Controls provenance signing for exports. |

## Operational observability and automation

| Variable group | Primary consumers | Source of truth | Notes |
| --- | --- | --- | --- |
| `DEPLOY_PREVIEW_TOKEN` | Ops, Web | Root `.env` | Injected into preview deployments for smoke tests. |
| `PROVENANCE_*` | Ops | Root `.env` | Thresholds governing provenance monitoring tasks. |
| `ALERTS_*` | Ops | Root `.env` | Slack/email/webhook targets and alerting thresholds for automation jobs. |

## Service-specific configuration

### API (`apps/api`)

| Variable | Purpose / divergence | Loader |
| --- | --- | --- |
| `NODE_ENV`, `PORT`, `LOG_LEVEL` | Standard runtime controls. | `apps/api/.env.example`, `apps/api/src/config.ts` |
| `AGENT_MODEL`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION` | Model selection for core workflows. | Same as above |
| `SUMMARISER_MODEL`, `MAX_SUMMARY_CHARS` | Optional summary overrides. | Same as above |
| `AGENT_STUB_MODE` | Allows local stubbed responses (`auto` default). | Same as above |
| `POLICY_VERSION` | Tag applied to generated artefacts for governance. | Same as above |
| Divergence | API keeps backward-compatible defaults for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` during development but still validates for production via `assertProductionEnv`. | `apps/api/src/config.ts` |

### Ops (`apps/ops`)

| Variable | Purpose | Loader |
| --- | --- | --- |
| `NODE_ENV` | Defaults to `development` through shared helper. | `apps/ops/.env.example`, `apps/ops/src/env.server.ts` |
| `OPS_CHECK_DRY_RUN`, `VECTOR_STORE_DRY_RUN` | Safety switches for automation runs. | Same as above |
| `API_BASE_URL` | Points to deployed API instance for orchestration commands. | Same as above |
| `OPS_ORG_ID`, `OPS_USER_ID`, `EVAL_*`, `TRANSPARENCY_*`, `SLO_*`, `DISPATCH_*`, `LEARNING_*`, `PERF_*`, `RED_TEAM_*` | Default identifiers for automation targets. | Same as above |
| `PERF_WINDOW`, `EVAL_BENCHMARK` | Additional tuning inputs for ops runs. | Same as above |
| Divergence | Ops requires non-empty Supabase and OpenAI credentials at parse time to fail fast locally. | `apps/ops/src/env.server.ts` |

### Web (`apps/web`)

| Variable | Purpose | Loader |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Needed for server actions; must match shared values. | `apps/web/.env.example`, `apps/web/src/env.server.ts` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side Supabase initialisation. | Same |
| `NEXT_PUBLIC_API_BASE_URL` | Points browser calls to the deployed API instance. | Same |
| `APP_ENV` | Distinguish deployment target (e.g., `local`, `staging`, `production`). | Same |
| `ADMIN_PANEL_ACTOR`, `ADMIN_PANEL_ORG`, `FEAT_ADMIN_PANEL` | Toggles privileged UI features. | Same |
| `NEXT_PUBLIC_*` thresholds | Dashboard tuning knobs for front-end. | `apps/web/.env.example`, `apps/web/src/env.client.ts` |
| Divergence | Web does not read OpenAI credentials; only Supabase secrets flow through the shared helper with stricter validation on the service-role key. | `apps/web/src/env.server.ts` |

### Legacy / project-specific snapshots

Directories under `JB/` maintain historical configuration examples. They reuse the shared variables above and add bespoke integrations (Google Drive ingestion, payment APIs, Redis rate limiting). The legacy `francophone-lex/` scaffolds have been removed to avoid vendor-specific drift, so JB now serves as the lone reference area.

## Using the shared helper

- Import `loadServerEnv` and the relevant schemas from `@avocat-ai/shared` when adding a new server-side loader.
- Extend the shared schemas with service-specific validation (for example, requiring non-empty values in Ops or keeping relaxed defaults in the API).
- Document any non-shared variables in this file so that future services know where to source configuration.

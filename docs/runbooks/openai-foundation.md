# OpenAI Foundation Runbook

## Overview

The platform now uses a centralised OpenAI client for every runtime (API, ops, edge). This runbook captures the operational knobs and observability hooks you need to keep the integration healthy.

## Configuration

Environment variables are read in all services. Set them in the relevant deployment target:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Default API key for the runtime. |
| `OPENAI_ORGANIZATION` | Optional organisation header (maps to OpenAI org). |
| `OPENAI_PROJECT` | Optional project header for granular billing/quotas. |
| `OPENAI_REQUEST_TAGS` | Fallback request tags (`key=value` pairs separated by commas). |
| `OPENAI_REQUEST_TAGS_API`, `OPENAI_REQUEST_TAGS_OPS`, `OPENAI_REQUEST_TAGS_EDGE` | Runtime-specific overrides layered on top of the fallback. |
| `OPENAI_CHATKIT_PROJECT`, `OPENAI_CHATKIT_SECRET` | Credentials for ChatKit Sessions API (optional until ChatKit integration is live). |
| `OPENAI_CHATKIT_BASE_URL` | Override base URL for ChatKit Sessions API calls (defaults to OpenAI public endpoint). |
| `OPENAI_CHATKIT_MODEL` | Default model used when creating ChatKit sessions. |
| `OPENAI_DEBUG_REQUESTS` | Set to `1` to enable request replay retrieval (requires platform access). |

For finance workloads, request tags should encode the service and component so Datadog/Splunk queries can pivot on them, e.g.

```
OPENAI_REQUEST_TAGS_API=service=api,component=finance-backend
OPENAI_REQUEST_TAGS_OPS=service=ops,component=finance-etl
OPENAI_REQUEST_TAGS_EDGE=service=edge,component=crawl-authorities
```

## Debugging

- When `OPENAI_DEBUG_REQUESTS=1`, failed calls trigger a follow-up fetch to the `debugging/requests` endpoint. The details are logged via Fastify/Pino (API) or stdout (ops/edge) with the `*_openai_debug` suffix so you can ship them to Datadog or Splunk. Search for `openaiRequestId` in logs to join the trace with the OpenAI dashboard.
- Edge workers expose `fetchOpenAIDenoDebugDetails` to retrieve request payloads when running in Deno.
- Ops CLI utilities print debugging payloads in red when failures occur. Redirect stdout to log files if you want to ingest them into your SIEM pipeline.

## Quotas & Projects

- Use `OPENAI_PROJECT` to isolate finance workloads. Each component can use its own project to receive independent quota/kWh reporting.
- The shared client automatically adds a cache key suffix per service (`api`, `ops`, `edge`) so token usage and retries are tracked separately.
- When provisioning a new environment, create a project in the OpenAI dashboard, assign the billing limits, then set `OPENAI_PROJECT` (and optionally `OPENAI_ORGANIZATION`).
- Map each finance domain to a guardrail bundle (e.g. tax, audit). Record the guardrail policy version in the agent metadata so audits and regulatory reviews can cross-reference it.

## Dashboards

1. **Requests & Errors**: Filter by `openai.requestTags.service` to trend error rates per service. Correlate with countdown logs from the client.
2. **Latency**: Use `openai.requestTags.component` to view average latency by component.
3. **Quota Usage**: Combine the org/project IDs with OpenAI’s billing export to monitor cost per finance agent.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| 401 / 403 errors | Verify API key, organisation, and project headers. Confirm secrets are loaded in the deployment environment. |
| Missing debug payloads | Ensure `OPENAI_DEBUG_REQUESTS=1` and that the runtime has access to the debugging API (requires Org admin privileges). |
| Vector-store sync failures | Confirm `OPENAI_VECTOR_STORE_AUTHORITIES_ID` and that the edge worker uses the correct project tags; inspect CLI output for `vector_store_attach_openai_debug`. |
| Mixed workloads in metrics | Set the `OPENAI_REQUEST_TAGS_*` overrides per runtime so dashboards can partition data. |
| Guardrail mismatch | Double-check that the finance agents in Agent Platform reference the latest policy version; update `OPENAI_REQUEST_TAGS_*` to include `policy=<version>` for deep linking. |

## Runbook Actions

1. Rotate API keys quarterly; update `.env`/secrets store and redeploy.
2. When onboarding a new finance agent, assign it to its own OpenAI project and set component-specific request tags.
3. Keep an eye on the `*_openai_debug` logs during incident response—they contain the exact payload OpenAI processed.

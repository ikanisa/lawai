# Engineering onboarding guide

Welcome to Avocat-AI! This guide walks new contributors through the first week of setup, aligned with our observability-first practices.

## Day 0 – Access checklist

- Request GitHub access to the `law-ai` organisation and join the `avocat-ai` team.
- Ask the platform team for credentials: Supabase project invite, Vercel project access, OpenAI API key.
- Enrol in PagerDuty rotation (Ops or Web) depending on your squad.

## Day 1 – Local environment

1. Clone the repo and follow the [workspace quickstart](../README.md#workspace-quickstart).
2. Copy `.env.example` to `.env.local` and populate secrets; validate with `pnpm env:validate`.
3. Run the smoke stack:
   ```bash
   pnpm dev:api
   pnpm --filter @apps/pwa run dev
   pnpm dev:web
   ```
4. Visit Grafana (link in 1Password) and pin the **Getting Started** dashboard.

## Day 2 – Observability orientation

- Read [`docs/observability.md`](observability.md) to understand log, metric, and trace conventions.
- Enable the OpenTelemetry collector in your dev environment (`docker compose up otel-collector`).
- Trigger sample spans by running `pnpm --filter @apps/ops run evaluate -- --suite smoke` and inspecting the **Automation** dashboard.

## Day 3 – Runbooks & ops

- Work through [`docs/RUNBOOKS.md`](RUNBOOKS.md) scenarios using dry-run mode.
- Pair with an existing operator to execute `pnpm --filter @apps/ops run foundation` in staging.
- File a practice incident in the sandbox Slack channel using the template from [`docs/ops/playbooks.md`](ops/playbooks.md).

## Day 4 – Feature flow

- Pick a good-first-issue in Jira and scaffold changes referencing the per-app README.
- Open a draft PR, ensuring lint/test/build scripts pass locally.
- Attach Grafana screenshots demonstrating the relevant dashboard panel (observability alignment requirement).

## Day 5 – Deployment readiness

- Shadow the release captain running `scripts/deployment-preflight.mjs`.
- Walk through Vercel promotion with them and note where observability dashboards confirm success.
- Update this guide with any gaps you encounter.

## Troubleshooting & support

- Network issues: review [`troubleshooting_network.md`](troubleshooting_network.md).
- Environment mismatches: check [`env-matrix.md`](env-matrix.md) and confirm secrets are in sync.
- Observability questions: ping #telemetry in Slack and share links to the affected dashboards.

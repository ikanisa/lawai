# Agent Evals Dashboards

This guide documents the evaluation dashboards that gate production deploys.

## Metrics
- **allowlisted_citation_precision_p95** — Target ≥ 0.95. Measures citation accuracy against curated allowlist.
- **temporal_validity_p95** — Target ≥ 0.95. Ensures referenced law is in-force.
- **maghreb_banner_coverage** — Target = 1.00. Guarantees Maghreb-specific compliance banner is shown when required.
- **hitl_recall_high_risk** — Target ≥ 0.98. Tracks recall of high-risk matters routed to HITL.

## Dashboards
| Dashboard | Source | URL |
| --------- | ------ | --- |
| Research IRAC Streaming | Observability / Supabase metrics | `https://grafana.internal/research-irac` |
| Drafting Studio Quality | OpenAI eval jobs + Supabase | `https://grafana.internal/drafting-quality` |
| Procedural Navigator SLA | Edge jobs telemetry | `https://grafana.internal/proc-navigator` |
| Voice Realtime Health | WebRTC metrics + token issuance | `https://grafana.internal/voice-live` |

## Deployment Gate Process
1. Trigger nightly eval pipeline via `apps/edge/eval-nightly` worker or queue it from the Ops CLI with `pnpm --filter @apps/ops exec tsx src/index.ts --schedule evaluation --org <org-id> --benchmark nightly-sanity`.
   - CLI output should display spinner transitions and `Benchmark nightly-sanity en file.` before returning `0`.
2. Review dashboards for regressions. If any metric breaches threshold, block deploy and open incident ticket.
3. Document findings in release notes and attach screenshots to the GO/NO-GO checklist.

## Backfill Instructions
- Use historical agent runs stored in `agent_runs` to replay prompts.
- Rehydrate citations by joining `run_citations` and `documents` tables.
- Persist eval outcomes to `agent_learning_jobs` for trend analysis.

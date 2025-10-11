# Monitoring Baseline (2025-02-07)

| Area              | Dashboard / Link                                 | Notes / Missing Alerts                    |
| ----------------- | ------------------------------------------------ | ----------------------------------------- |
| API latency       | _add Grafana / Datadog link_                      | Stage 5: add alert on p95 > 500 ms        |
| Edge queue health | _add Grafana / Datadog link_                      | Stage 5: alert if pending jobs > 10       |
| Supabase quotas   | Supabase project → Usage dashboard                | Stage 5: add Slack alert on 80 % usage    |
| Frontend vitals   | _Vercel Analytics or custom dashboard link_       | Stage 3: ensure mobile vitals instrumented|
| Fairness metrics  | _Trust dashboard URL_                             | Stage 5: wire automatic regression alerts |

Update this file whenever new dashboards or alerts are configured during the refactor.


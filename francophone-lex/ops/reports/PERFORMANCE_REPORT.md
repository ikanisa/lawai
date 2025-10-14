# Performance Report

## Current Telemetry
- API performance snapshots capture latency, allowlist ratio, HITL response times (`supabase/migrations/20240101004100_performance_snapshots.sql:1-23`, `apps/api/src/server.ts:1963-2050`).
- Core Web Vitals (LCP/INP/CLS) emitted via `reportWebVitals` and surfaced in operations overview + performance snapshots (`apps/web/reportWebVitals.ts`, `apps/api/src/server.ts:539-724`, `apps/ops/src/performance-snapshot.ts:46-129`).

## Gaps vs Targets
- ❗ Web vitals are aggregated org-wide; route-level breakdown and device segmentation still missing.
- ❗ Performance snapshots require manual review — no automated alerting on vitals/latency breaches yet.
- Ops CLI still reuses allowlist ratio as a proxy for citation precision in metadata; needs explicit metric separation.

## Recommendations
1. Extend telemetry aggregation to store per-route vitals (Research, Admin, Trust) and surface mobile vs desktop deltas.
2. Trigger Slack/PagerDuty alerts when `webVitals.alerts` contains budget breaches for two consecutive snapshots.
3. Update `performance-snapshot` payload to include dedicated citation precision vs allowlist ratios and track trend deltas.

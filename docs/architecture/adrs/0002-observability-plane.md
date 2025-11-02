# ADR 0002: Unified observability plane

- **Status:** Accepted (2025-02-12)
- **Context:** Prior monitoring relied on ad-hoc logs and per-service dashboards. Lacked end-to-end tracing across API, Edge, and Ops tooling. Incident response struggled to correlate user-facing regressions with backend automation.
- **Decision:** Standardise on a shared observability toolkit (`@avocat-ai/observability`) that configures OpenTelemetry exporters, structured logging, and consistent tagging (`OPENAI_REQUEST_TAGS*`). Dashboards aggregate metrics in Grafana, while alerting flows through Ops automations.
- **Consequences:**
  - ✅ Single source of truth for SLOs and runbooks. Dashboards referenced in `docs/observability.md` align with Ops playbooks.
  - ✅ Easier to onboard engineers—instrumentation helper auto-registers resource attributes.
  - ⚠️ Requires OTLP collectors per environment and credentials propagated via environment matrix.
  - ⚠️ Edge functions must emit JSON logs compatible with the ingestion pipeline; additional shims maintained in `apps/edge`.

Follow-up work tracks high-cardinality metric costs and potential APM integration.

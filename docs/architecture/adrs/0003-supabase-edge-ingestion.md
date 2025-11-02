# ADR 0003: Supabase Edge orchestration for ingestion

- **Status:** Accepted (2025-02-12)
- **Context:** Legal authority ingestion requires scheduled crawls, delta detection, and provenance audits. Running these workers inside the API process risked noisy neighbours and blocking the request loop.
- **Decision:** Move ingestion, learning, and transparency tasks into Supabase Edge Functions triggered via cron and webhooks. Ops CLI coordinates provisioning and secrets rotation; API communicates through signed callbacks.
- **Consequences:**
  - ✅ Horizontal isolation between user traffic (API) and ingestion workloads.
  - ✅ Fine-grained deployment using `supabase functions deploy <name>` with versioned artifacts.
  - ⚠️ Deno runtime constraints (no native Node modules) require polyfills and shared shims (`apps/edge/lib`).
  - ⚠️ Observability relies on shipping logs to the central collector; failures degrade dashboards if misconfigured.

Operational scenarios are codified in [`../runbooks`](../runbooks) and linked from `docs/RUNBOOKS.md`.

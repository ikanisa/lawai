# Learning Semantic Search

> Semantic search powers the research desk retrieval loop. This guide explains how to monitor ingestion, tune embeddings, and diagnose ranking so learning signals keep surfacing the right authorities.

## Table of Contents
- [Quickstart (90 seconds)](#quickstart)
- [Understand the Retrieval Stack](#retrieval-stack)
- [Tune Embedding Coverage](#tune-embedding-coverage)
- [Diagnose Ranking Regressions](#ranking-diagnostics)
- [Observability Checklist](#observability)

<a id="quickstart"></a>
## Quickstart (90 seconds)

Follow these four steps to stabilize a semantic search regression in under two minutes:

1. **Check ingestion freshness.** Hit the telemetry dashboard or query `vector_ingest_jobs` to confirm the last completed job. If you spot stale corpora, jump to [Understand the Retrieval Stack](#retrieval-stack) for ingestion controls.
2. **Sample the research API.** Call `/research/context` in the API to pull a known-good plan and citations; if the payload looks empty, proceed to [Tune Embedding Coverage](#tune-embedding-coverage) to inspect embeddings.
3. **Replay an IRAC flow in the web client.** Use the research desk UI’s "Evidence" view to see which citations are surfaced. Mis-ranked results? Head to [Diagnose Ranking Regressions](#ranking-diagnostics).
4. **Log corrective actions.** Document fixes in `agent_learning_jobs` and attach telemetry snapshots so the nightly evaluator can verify improvements; wrap up with the [Observability Checklist](#observability).

<a id="retrieval-stack"></a>
## Understand the Retrieval Stack

The semantic search service relies on three tightly coupled layers:

- **Corpus ingestion.** Extraction jobs segment source material into normalized chunks with jurisdictional metadata. Monitoring `vector_ingest_jobs` ensures each corpus refresh completes before embedding.
- **Embedding and storage.** Chunk payloads are vectorized with jurisdiction-specific encoders and stored in Supabase `legal_vectors`, keyed by `org_id` and `topic`.
- **API composition.** The Fastify route clones a curated plan, default citations, and tool hints so clients have a consistent baseline before ranking adjustments.

> [!EXAMPLE] **API sample – bootstrap retrieval context**
> Review `apps/api/src/routes/research/data.ts` to see `cloneResearchContext()` and `createResearchStream()` assembling the default plan, citations, and simulated tool events that downstream ranking expects.

Cross-link: when ingestion is green but responses are sparse, validate the embedding coverage in [Tune Embedding Coverage](#tune-embedding-coverage).

<a id="tune-embedding-coverage"></a>
## Tune Embedding Coverage

Embedding drift usually surfaces as empty or irrelevant citations. Use this loop to tighten coverage:

1. **Inspect chunk health.** Query `legal_vectors` for the affected jurisdiction and ensure recent chunks carry non-null `embedding` arrays.
2. **Re-embed stale data.** Trigger the jurisdictional encoder via `embedding-refresher` with the updated prompts or model weights.
3. **Audit default citations.** Compare the API defaults against the UI – if baseline citations are misaligned, update the seed data in [`apps/api/src/routes/research/data.ts`](../apps/api/src/routes/research/data.ts) so the research desk reflects the authoritative sources.

> [!TIP] **Front-end verification**
> `apps/web/src/features/research/components/research-view.tsx` renders the plan drawer, evidence mode, and risk banner. Use it to confirm that updated citations and risk notes render as expected after embedding refreshes.

Once embeddings look healthy, confirm ranking quality via [Diagnose Ranking Regressions](#ranking-diagnostics).

<a id="ranking-diagnostics"></a>
## Diagnose Ranking Regressions

Ranking regressions manifest as high-variance cosine scores or missing authorities.

- **Compare similarity distributions.** Capture before/after histograms for `similarity_score` to spot model drift.
- **Replay saved questions.** Use cached IRAC payloads to measure citation overlap; if coverage drops below thresholds, schedule a synonym or canonicalizer update.
- **Review UI clickthroughs.** The research desk captures citation visits—low clickthrough with high similarity usually means over-broad embeddings and needs tightening in [Tune Embedding Coverage](#tune-embedding-coverage).

Document all findings in `agent_learning_jobs` so they flow into the learning overview.

<a id="observability"></a>
## Observability Checklist

Before closing an incident, confirm:

- `vector_ingest_jobs` show healthy completion times.
- Supabase `legal_vectors` row counts match the expected corpus size.
- Nightly evaluator dashboards are green for `semantic_search_precision` and `dead_link_rate`.
- Research desk UI surfaces updated citations without console errors.

Link this checklist when filing post-mortems so future responders can jump straight to the [Quickstart (90 seconds)](#quickstart).

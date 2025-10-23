# Vector Embeddings Overview

This document describes how vector embeddings are generated and consumed within
the Avocat AI stack. It captures both the architectural constraints and the
developer ergonomics that guide our retrieval-augmented workflows.

## Pipeline summary

1. **Document preparation** – source content is normalized and chunked into
   semantically coherent passages.
2. **Embedding generation** – chunks are embedded with the OpenAI
   text-embedding API and stored with their metadata in the vector store.
3. **Index management** – scheduled maintenance jobs prune obsolete vectors and
   rebuild indexes when schema changes are detected.
4. **Query execution** – downstream services retrieve the nearest neighbors for
   a query vector and project the results into task-specific answer templates.

## Local development tips

- Prefer batched embedding requests to avoid hitting rate limits.
- Monitor vector dimensionality whenever providers are swapped; schema drift can
  break scoring heuristics.
- Capture representative queries in fixtures so regressions in similarity
  scoring are easy to diagnose.

## Validation

Before opening a pull request, run the documentation check to ensure Markdown
style stays consistent:

```sh
pnpm run lint:docs
```

The command enforces `markdownlint` on this file and mirrors the check executed
in CI. Updates that fail this validation will block merges until they are
fixed.

# Vector Embeddings Guide

OpenAI embeddings encode text into dense numeric vectors that can power search, clustering, recommendation, anomaly detection, and classification workflows. This guide captures the latest platform capabilities and how to configure our stack to leverage them.

## Available models

| Model | Dimensions (default) | Notes |
| --- | --- | --- |
| `text-embedding-3-small` | 1,536 | Lower cost, multilingual support, high throughput. |
| `text-embedding-3-large` | 3,072 | Highest accuracy across MTEB benchmarks. |

The third-generation models offer better multilingual performance and allow trading off cost versus accuracy by reducing vector length at request time.

## Requesting embeddings

Use the official OpenAI SDK or HTTPS API to create embeddings. The SDK example below automatically includes the optional `dimensions` field when it is configured through `EMBEDDING_DIMENSION`.

```ts
const response = await openai.embeddings.create({
  model: env.EMBEDDING_MODEL,
  input: text,
  ...(env.EMBEDDING_DIMENSION ? { dimensions: env.EMBEDDING_DIMENSION } : {}),
});
```

When calling the REST API directly, include the same field in the JSON payload:

```json
{
  "model": "text-embedding-3-large",
  "input": ["Document paragraph"],
  "dimensions": 1024
}
```

If `dimensions` is omitted, OpenAI returns the model's full vector length (1,536 or 3,072 numbers respectively).

## Resizing embeddings

Third-generation models can shorten vectors without losing the semantic neighbourhood that powers retrieval. Set the optional `EMBEDDING_DIMENSION` environment variable to trim vectors at generation time:

```
EMBEDDING_DIMENSION=1024
```

Operations tooling now forwards this value everywhere embeddings are generated—summarisation pipelines, hybrid question answering, and vector-store sync jobs—so the platform stays consistent whether it uses the SDK or raw HTTP requests.

If you need to post-process an existing embedding, normalise the truncated vector with the L2 norm to preserve cosine-similarity behaviour.

## Recommended use cases

- **Semantic search** – index document chunks and rank results by cosine similarity to the query vector.
- **Clustering and analytics** – group similar reviews, incidents, or jurisprudence to surface trends.
- **Recommendations** – compare user and content embeddings to identify the closest matches.
- **Anomaly detection** – flag outliers whose vectors are distant from the cohort.
- **Zero-shot classification** – embed class descriptors and pick the label closest to the input vector.

## Cost awareness

Embedding requests are billed per input token. Shorter vectors reduce storage costs in pgvector or external vector databases and speed up similarity calculations. Monitor retrieval latency and adjust `EMBEDDING_DIMENSION` to balance accuracy with resource usage.

## Testing

Run the API test suite to ensure embedding mocks continue to align with the updated request payload:

```
npm test --workspace @apps/api
```

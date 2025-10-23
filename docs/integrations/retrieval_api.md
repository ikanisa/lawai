# OpenAI Retrieval API Integration Guide

This guide explains how to ingest documents into an OpenAI vector store and perform semantic search over them, so the Francophone Avocat agents can ground answers on authoritative sources.

## 1. Create a vector store and upload files

Use the official OpenAI Python SDK to create a vector store and upload the files that should be searchable by the agent.

```python
from openai import OpenAI

client = OpenAI()

vector_store = client.vector_stores.create(
    name="Support FAQ",
)

client.vector_stores.files.upload_and_poll(
    vector_store_id=vector_store.id,
    file=open("customer_policies.txt", "rb"),
)
```

The helper `upload_and_poll` blocks until chunking and embedding are complete, so the file is ready for search before the call returns.

## 2. Run semantic search queries

Semantic search lets the agent surface contextually relevant results even when there is little or no keyword overlap with the query.

```python
user_query = "What is the return policy?"

results = client.vector_stores.search(
    vector_store_id=vector_store.id,
    query=user_query,
)
```

Each result contains chunk text, similarity scores, and the originating file so you can attribute citations in responses.

### Result payload example

```json
{
  "object": "vector_store.search_results.page",
  "search_query": "How many woodchucks are allowed per passenger?",
  "data": [
    {
      "file_id": "file-12345",
      "filename": "woodchuck_policy.txt",
      "score": 0.85,
      "attributes": {
        "region": "North America",
        "author": "Wildlife Department"
      },
      "content": [
        { "type": "text", "text": "According to the latest regulations, each passenger is allowed to carry up to two woodchucks." },
        { "type": "text", "text": "Ensure that the woodchucks are properly contained during transport." }
      ]
    }
  ],
  "has_more": false
}
```

Set `max_num_results` to return up to 50 chunks per query when you need broader coverage.

## 3. Improve ranking with query rewriting

The API can automatically rewrite user queries to improve retrieval quality. Enable rewriting and inspect the rewritten prompt in the response payload.

```python
results = client.vector_stores.search(
    vector_store_id=vector_store.id,
    query="I'd like to know the height of the main office building.",
    rewrite_query=True,
)
print(results.search_query)  # "primary office building height"
```

## 4. Filter by file attributes

Attach metadata to uploaded files and use comparison or compound filters when running searches. Filters execute server-side, so only the relevant subset of documents is scored.

```python
results = client.vector_stores.search(
    vector_store_id=vector_store.id,
    query="Hazardous materials transport",
    attribute_filter={
        "type": "and",
        "filters": [
            { "type": "eq", "key": "region", "value": "us" },
            { "type": "gte", "key": "date", "value": 1704067200 }
        ]
    },
)
```

Supported comparison operators include `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, and `nin`.

## 5. Tune ranking thresholds

If recall is too broad, increase the `score_threshold` in `ranking_options` to drop low-confidence matches. You can also select a specific ranker, such as `auto` or `default-2024-08-21`, to suit production quality requirements.

## 6. Manage vector stores and files

Vector stores hold the embedded chunks that power semantic search. Keep the following constraints in mind when planning ingestion jobs:

- Maximum file size: 512 MB
- Maximum tokens per file: 5,000,000
- Default chunking: 800-token windows with 400-token overlap
- Custom chunking: `max_chunk_size_tokens` must be between 100 and 4096, and `chunk_overlap_tokens` must not exceed half the chunk size

Use the management helpers to add or remove files, update attributes, or apply expiration policies.

```python
client.vector_stores.update(
    vector_store_id=vector_store.id,
    expires_after={"anchor": "last_active_at", "days": 7},
)
```

Expiration automatically deletes associated chunks after the configured inactivity window, helping control storage costs.

## 7. Pricing considerations

The Retrieval API bills storage across all vector stores you own. The first 1 GB is free; beyond that, budget for $0.10 per GB per day. Remove unused files or apply expirations to manage spend.

## 8. Synthesise grounded responses

Combine search results with a chat completion to deliver answers that cite the retrieved snippets.

```python
formatted_results = format_results(results.data)

completion = client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "developer", "content": "Produce a concise answer to the query based on the provided sources."},
        {"role": "user", "content": f"Sources: {formatted_results}\n\nQuery: '{user_query}'"},
    ],
)
print(completion.choices[0].message.content)
```

Implement `format_results` to flatten chunk content, and ensure the response renderer surfaces citations from `results.data`.

---

With the Retrieval API wired into ingestion and evaluation pipelines, the Avocat agents can perform hybrid search: Supabase `match_chunks` for local authorities plus OpenAI File Search for hosted corpora. Use the attribute filtering and ranking controls above to align retrieval quality with jurisdictional guardrails and governance policies.

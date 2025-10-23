# Vector Store Runbook

## Overview
Vector stores provide the semantic search backbone for Retrieval API workflows and the file search tool. When you upload a file into a vector store, the platform automatically chunks, embeds, and indexes the file so that queries can be answered against its contents.

Each vector store manages a collection of `vector_store.file` objects. These objects reference uploaded `file` resources, track metadata attributes, and expose search functionality for downstream synthesis.

## Object model
- **file** – Raw content uploaded through the Files API. Files can be reused for fine-tuning and other workloads, but they also back vector store documents.
- **vector_store** – The container that owns all chunked, embedded files and their associated configuration (including expiration policy).
- **vector_store.file** – A wrapper around a chunked file within a given vector store. These entries support metadata attributes for filtering search results.

## Pricing
Storage fees are calculated across the total size of all chunks and embeddings stored in vector stores.

| Storage tier | Cost |
| --- | --- |
| Up to 1 GB | Free |
| Beyond 1 GB | $0.10 per GB per day |

Use expiration policies to automatically delete inactive stores and limit costs.

## Core operations

### Manage vector stores
```python
# Create a new vector store and attach an existing file
client.vector_stores.create(
    name="Support FAQ",
    file_ids=["file_123"],
)

# Retrieve, update, or delete by ID
client.vector_stores.retrieve(vector_store_id)
client.vector_stores.update(vector_store_id, expires_after={"anchor": "last_active_at", "days": 7})
client.vector_stores.delete(vector_store_id)
client.vector_stores.list()
```

### Manage files within a store
```python
# Upload a file and wait for chunking/embedding to complete
client.vector_stores.files.create_and_poll(
    vector_store_id="vs_123",
    file_id="file_123",
)

# Add multiple files in batch
client.vector_stores.file_batches.create_and_poll(
    vector_store_id="vs_123",
    file_ids=["file_123", "file_456"],
)

# Manage individual vector_store.file entries
client.vector_stores.files.retrieve(vector_store_id, file_id)
client.vector_stores.files.update(vector_store_id, file_id, attributes={"region": "US"})
client.vector_stores.files.delete(vector_store_id, file_id)
client.vector_stores.files.list(vector_store_id)
```

### Attribute filtering
Each `vector_store.file` can store a dictionary of up to 16 attribute keys (256 characters per key). These attributes can later be used to scope semantic searches.

```python
client.vector_stores.files.create(
    vector_store_id="vs_123",
    file_id="file_123",
    attributes={
        "region": "US",
        "category": "Marketing",
        "date": 1672531200,
    },
)
```

## Chunking configuration
Files are chunked with an 800-token window and 400-token overlap by default. Override the chunking strategy when attaching files:

- `max_chunk_size_tokens`: 100–4096 tokens.
- `chunk_overlap_tokens`: 0 up to half of `max_chunk_size_tokens`.

## Limits
- Maximum file size: 512 MB.
- Maximum tokens per file: 5,000,000.

## Search and response synthesis
```python
from openai import OpenAI

client = OpenAI()

results = client.vector_stores.search(
    vector_store_id=vector_store.id,
    query="What is the return policy?",
)

formatted_results = format_results(results.data)

completion = client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {"role": "developer", "content": "Produce a concise answer to the query based on the provided sources."},
        {"role": "user", "content": f"Sources: {formatted_results}\n\nQuery: 'What is the return policy?'"},
    ],
)

print(completion.choices[0].message.content)
```

Example helper for formatting search results:

```python
def format_results(results):
    formatted_results = ""
    for result in results:
        formatted_result = f"<result file_id='{result.file_id}' file_name='{result.file_name}'>"
        for part in result.content:
            formatted_result += f"<content>{part.text}</content>"
        formatted_results += formatted_result + "</result>"
    return f"<sources>{formatted_results}</sources>"
```

## Deployment considerations
- Monitor storage usage and apply expiration policies to idle stores.
- Favor batch operations for large document imports to keep ingestion consistent.
- Ensure attributes are consistently applied so that downstream filters align with support, marketing, or regional segmentation needs.


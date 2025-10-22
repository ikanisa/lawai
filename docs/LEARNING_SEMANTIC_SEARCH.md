# Semantic Search

Semantic search is a technique that leverages vector embeddings to surface semantically relevant results. Importantly, this includes results with few or no shared keywords, which classical search techniques might miss.

For example, let's look at potential results for "When did we go to the moon?":

| Text | Keyword Similarity | Semantic Similarity |
| --- | --- | --- |
| The first lunar landing occurred in July of 1969. | 0% | 65% |
| The first man on the moon was Neil Armstrong. | 27% | 43% |
| When I ate the moon cake, it was delicious. | 40% | 28% |

*(Jaccard used for keyword, cosine with `text-embedding-3-small` used for semantic.)*

Notice how the most relevant result contains none of the words in the search query. This flexibility makes semantic search a very powerful technique for querying knowledge bases of any size.

Semantic search is powered by vector stores, which we cover in detail later in the guide. This section will focus on the mechanics of semantic search.

## Performing semantic search

You can query a vector store using the search function and specifying a query in natural language. This will return a list of results, each with the relevant chunks, similarity scores, and file of origin.

```python
results = client.vector_stores.search(
    vector_store_id=vector_store.id,
    query="How many woodchucks are allowed per passenger?",
)
```

Example response:

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
        {
          "type": "text",
          "text": "According to the latest regulations, each passenger is allowed to carry up to two woodchucks."
        },
        {
          "type": "text",
          "text": "Ensure that the woodchucks are properly contained during transport."
        }
      ]
    },
    {
      "file_id": "file-67890",
      "filename": "transport_guidelines.txt",
      "score": 0.75,
      "attributes": {
        "region": "North America",
        "author": "Transport Authority"
      },
      "content": [
        {
          "type": "text",
          "text": "Passengers must adhere to the guidelines set forth by the Transport Authority regarding the transport of woodchucks."
        }
      ]
    }
  ],
  "has_more": false,
  "next_page": null
}
```

A response will contain 10 results maximum by default, but you can set up to 50 using the `max_num_results` parameter.

## Query rewriting

Certain query styles yield better results, so we've provided a setting to automatically rewrite your queries for optimal performance. Enable this feature by setting `rewrite_query=true` when performing a search.

The rewritten query will be available in the result's `search_query` field.

| Original | Rewritten |
| --- | --- |
| I'd like to know the height of the main office building. | primary office building height |
| What are the safety regulations for transporting hazardous materials? | safety regulations for hazardous materials |
| How do I file a complaint about a service issue? | service complaint filing process |

## Attribute filtering

Attribute filtering helps narrow down results by applying criteria, such as restricting searches to a specific date range. You can define and combine criteria in `attribute_filter` to target files based on their attributes before performing semantic search.

Use comparison filters to compare a specific key in a file's attributes with a given value, and compound filters to combine multiple filters using `and` and `or`.

**Comparison filter**

```json
{
  "type": "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "nin",
  "key": "attributes_key",
  "value": "target_value"
}
```

**Compound filter**

```json
{
  "type": "and" | "or",
  "filters": [...]
}
```

Examples:

- Filter for a region

  ```json
  {
    "type": "eq",
    "key": "region",
    "value": "us"
  }
  ```

- Filter by date range

  ```json
  {
    "type": "and",
    "filters": [
      {
        "type": "gte",
        "key": "date",
        "value": 1672531200
      },
      {
        "type": "lte",
        "key": "date",
        "value": 1704067200
      }
    ]
  }
  ```

- Include specific filenames

  ```json
  {
    "type": "in",
    "key": "filename",
    "value": ["woodchuck_policy.txt", "transport_guidelines.txt"]
  }
  ```

- Exclude filenames

  ```json
  {
    "type": "nin",
    "key": "filename",
    "value": ["draft_notes.txt"]
  }
  ```

- Complex nested filter

  ```json
  {
    "type": "and",
    "filters": [
      {
        "type": "eq",
        "key": "region",
        "value": "us"
      },
      {
        "type": "or",
        "filters": [
          {
            "type": "in",
            "key": "category",
            "value": ["policy", "regulation"]
          },
          {
            "type": "gte",
            "key": "score",
            "value": 0.8
          }
        ]
      }
    ]
  }
  ```

## Ranking

If you find that your file search results are not sufficiently relevant, you can adjust the `ranking_options` to improve the quality of responses. This includes specifying a `ranker`, such as `auto` or `default-2024-08-21`, and setting a `score_threshold` between 0.0 and 1.0. A higher `score_threshold` will limit the results to more relevant chunks, though it may exclude some potentially useful ones.

## Vector stores

Vector stores are the containers that power semantic search for the Retrieval API and the file search tool. When you add a file to a vector store it will be automatically chunked, embedded, and indexed.

Vector stores contain `vector_store_file` objects, which are backed by a `file` object.

| Object type | Description |
| --- | --- |
| `file` | Represents content uploaded through the Files API. Often used with vector stores, but also for fine-tuning and other use cases. |
| `vector_store` | Container for searchable files. |
| `vector_store.file` | Wrapper type specifically representing a file that has been chunked and embedded, and has been associated with a `vector_store`. Contains attributes map used for filtering. |

## Pricing

You will be charged based on the total storage used across all your vector stores, determined by the size of parsed chunks and their corresponding embeddings.

| Storage | Cost |
| --- | --- |
| Up to 1 GB (across all stores) | Free |
| Beyond 1 GB | $0.10/GB/day |

See expiration policies for options to minimize costs.

## Vector store operations

### Create

```python
client.vector_stores.create(
    name="Support FAQ",
    file_ids=["file_123"]
)
```

### Retrieve

```python
client.vector_stores.retrieve(vector_store_id="vs_123")
```

### Update

```python
client.vector_stores.update(
    vector_store_id="vs_123",
    expires_after={
        "anchor": "last_active_at",
        "days": 7
    }
)
```

### Delete

```python
client.vector_stores.delete(vector_store_id="vs_123")
```

### List

```python
client.vector_stores.list()
```

## Vector store file operations

Some operations, like `create` for `vector_store.file`, are asynchronous and may take time to complete — use helper functions such as `create_and_poll` to block until completion. Otherwise, poll for status updates manually.

### Create

```python
client.vector_stores.files.create_and_poll(
    vector_store_id="vs_123",
    file_id="file_123"
)
```

### Batch create

```python
client.vector_stores.file_batches.create_and_poll(
    vector_store_id="vs_123",
    file_ids=["file_123", "file_456"]
)
```

### Upload

```python
client.vector_stores.files.upload(
    vector_store_id="vs_123",
    file=open("woodchuck_policy.txt", "rb")
)
```

### Retrieve

```python
client.vector_stores.files.retrieve(
    vector_store_id="vs_123",
    file_id="file_123"
)
```

### Update

```python
client.vector_stores.files.update(
    vector_store_id="vs_123",
    file_id="file_123",
    attributes={
        "region": "US",
        "category": "Marketing",
        "date": 1672531200
    }
)
```

### Delete

```python
client.vector_stores.files.delete(
    vector_store_id="vs_123",
    file_id="file_123"
)
```

### List

```python
client.vector_stores.files.list(vector_store_id="vs_123")
```

## Attributes

Each `vector_store.file` can have associated attributes, a dictionary of values that can be referenced when performing semantic search with attribute filtering. The dictionary can have at most 16 keys, with a limit of 256 characters each.

```python
client.vector_stores.files.create(
    vector_store_id="<vector_store_id>",
    file_id="file_123",
    attributes={
        "region": "US",
        "category": "Marketing",
        "date": 1672531200
    }
)
```

## Expiration policies

You can set an expiration policy on `vector_store` objects with `expires_after`. Once a vector store expires, all associated `vector_store.file` objects will be deleted and you'll no longer be charged for them.

```python
client.vector_stores.update(
    vector_store_id="vs_123",
    expires_after={
        "anchor": "last_active_at",
        "days": 7
    }
)
```

## Limits

- Maximum file size: 512 MB.
- Maximum tokens per file: 5,000,000.

## Chunking

By default, `max_chunk_size_tokens` is set to 800 and `chunk_overlap_tokens` is set to 400, meaning every file is indexed by being split up into 800-token chunks, with 400-token overlap between consecutive chunks.

Adjust the chunking behaviour by setting `chunking_strategy` when adding files to the vector store.

Constraints:

- `max_chunk_size_tokens` must be between 100 and 4096 (inclusive).
- `chunk_overlap_tokens` must be non-negative and should not exceed `max_chunk_size_tokens / 2`.

## Supported file types

Refer to the Files API documentation for the up-to-date list of supported file types.

## Synthesizing responses

After performing a query you may want to synthesize a response based on the results. You can leverage our models to do so by supplying the results and original query to get back a grounded response.

Perform search query to get results:

```python
from openai import OpenAI

client = OpenAI()

user_query = "What is the return policy?"

results = client.vector_stores.search(
    vector_store_id=vector_store.id,
    query=user_query,
)
```

Format results and synthesize a response:

```python
formatted_results = format_results(results.data)

completion = client.chat.completions.create(
    model="gpt-4.1",
    messages=[
        {
            "role": "developer",
            "content": "Produce a concise answer to the query based on the provided sources."
        },
        {
            "role": "user",
            "content": f"Sources: {formatted_results}\n\nQuery: '{user_query}'"
        }
    ],
)

print(completion.choices[0].message.content)
```

Example output:

```
Our return policy allows returns within 30 days of purchase.
```

Sample result formatting helper:

```python
def format_results(results):
    formatted_results = ''
    for result in results.data:
        formatted_result = f"<result file_id='{result.file_id}' file_name='{result.file_name}'>"
        for part in result.content:
            formatted_result += f"<content>{part.text}</content>"
        formatted_results += formatted_result + "</result>"
    return f"<sources>{formatted_results}</sources>"
```


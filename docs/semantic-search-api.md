# Semantic Search API

The Semantic Search API enables powerful natural language search over vector stores using OpenAI's vector embeddings. This allows finding semantically relevant documents even when they don't share keywords with the query.

## Overview

Semantic search leverages vector embeddings to surface contextually relevant results. For example, searching for "When did we go to the moon?" will return documents about the 1969 lunar landing, even though they don't contain the exact search terms.

## Endpoint

```
POST /api/vector-stores/:vectorStoreId/search
```

## Request Parameters

### Path Parameters

- `vectorStoreId` (required): The ID of the vector store to search (e.g., `vs_abc123`)

### Request Body

```json
{
  "query": string,                    // Natural language search query (required, min 1 char)
  "max_num_results": number,          // Maximum results to return (default: 10, max: 50)
  "rewrite_query": boolean,           // Enable automatic query rewriting (optional)
  "attribute_filter": object,         // Filter results by attributes (optional)
  "ranking_options": object           // Ranking configuration (optional)
}
```

## Features

### 1. Basic Search

Perform a simple semantic search:

```bash
curl -X POST http://localhost:3333/api/vector-stores/vs_abc123/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the contract execution requirements?",
    "max_num_results": 10
  }'
```

### 2. Query Rewriting

Enable automatic query optimization for better results:

```json
{
  "query": "I'd like to know the height of the main office building.",
  "max_num_results": 10,
  "rewrite_query": true
}
```

The rewritten query (e.g., "primary office building height") will be returned in the response.

### 3. Attribute Filtering

Filter results based on file attributes using comparison or compound filters.

#### Comparison Filters

Available operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`

**Filter by jurisdiction:**
```json
{
  "query": "legal requirements",
  "attribute_filter": {
    "type": "eq",
    "key": "jurisdiction",
    "value": "OHADA"
  }
}
```

**Filter by date range:**
```json
{
  "attribute_filter": {
    "type": "gte",
    "key": "date",
    "value": 1672531200
  }
}
```

**Filter by multiple values:**
```json
{
  "attribute_filter": {
    "type": "in",
    "key": "category",
    "value": ["Marketing", "Sales", "Legal"]
  }
}
```

#### Compound Filters

Combine multiple filters with `and` or `or`:

```json
{
  "query": "legal requirements",
  "attribute_filter": {
    "type": "and",
    "filters": [
      {
        "type": "eq",
        "key": "jurisdiction",
        "value": "OHADA"
      },
      {
        "type": "gte",
        "key": "date",
        "value": 1672531200
      }
    ]
  }
}
```

**Nested compound filters:**
```json
{
  "attribute_filter": {
    "type": "and",
    "filters": [
      {
        "type": "or",
        "filters": [
          { "type": "eq", "key": "region", "value": "us" },
          { "type": "eq", "key": "region", "value": "eu" }
        ]
      },
      {
        "type": "gte",
        "key": "date",
        "value": 1672531200
      }
    ]
  }
}
```

### 4. Ranking Options

Tune result relevance with ranking options:

```json
{
  "query": "contract requirements",
  "ranking_options": {
    "ranker": "auto",
    "score_threshold": 0.75
  }
}
```

**Parameters:**
- `ranker`: `"auto"` or `"default-2024-08-21"`
- `score_threshold`: Minimum similarity score (0.0 - 1.0). Higher values return only highly relevant results.

## Response Format

```json
{
  "object": "vector_store.search_results.page",
  "search_query": "contract execution requirements",
  "data": [
    {
      "file_id": "file-abc123",
      "filename": "legal_code_article_1132.txt",
      "score": 0.85,
      "attributes": {
        "jurisdiction": "OHADA",
        "type": "code",
        "date": 1672531200
      },
      "content": [
        {
          "type": "text",
          "text": "According to Article 1132, parties must execute contractual obligations in good faith."
        },
        {
          "type": "text",
          "text": "Prior notice is required before claiming damages for breach of contract."
        }
      ]
    }
  ],
  "has_more": false,
  "next_page": null
}
```

### Response Fields

- `object`: Always `"vector_store.search_results.page"`
- `search_query`: The query used (may be rewritten if `rewrite_query` was enabled)
- `data`: Array of search results
  - `file_id`: Unique file identifier
  - `filename`: Name of the file
  - `score`: Similarity score (0.0 - 1.0, higher is more relevant)
  - `attributes`: File metadata for filtering
  - `content`: Array of text chunks from the file
- `has_more`: Whether more results are available
- `next_page`: Pagination cursor (if applicable)

## Error Responses

### 400 Bad Request
Invalid request parameters:
```json
{
  "error": "invalid_request",
  "details": {
    "fieldErrors": {
      "query": ["String must contain at least 1 character(s)"]
    }
  }
}
```

### 503 Service Unavailable
Vector store search API not available:
```json
{
  "error": "vector_store_search_unavailable",
  "message": "Vector store search API is not available"
}
```

### 500 Internal Server Error
Search operation failed:
```json
{
  "error": "search_failed",
  "message": "Error details"
}
```

## Usage Examples

### Using Helper Functions

When working with the JavaScript/TypeScript SDK:

```typescript
import {
  createComparisonFilter,
  createCompoundFilter,
  formatSearchResultsForLLM,
} from '@avocat-ai/shared';

// Create filters
const jurisdictionFilter = createComparisonFilter('jurisdiction', 'eq', 'OHADA');
const dateFilter = createComparisonFilter('date', 'gte', 1672531200);
const compoundFilter = createCompoundFilter('and', [jurisdictionFilter, dateFilter]);

// Make request
const response = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'contract requirements',
    max_num_results: 10,
    attribute_filter: compoundFilter,
  }),
});

const results = await response.json();

// Format for LLM
const formattedContext = formatSearchResultsForLLM(results.data);
```

### Synthesizing LLM Responses

Combine search results with an LLM to generate grounded responses:

```typescript
// Perform search
const searchResults = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'What is the return policy?',
    max_num_results: 5,
  }),
}).then(r => r.json());

// Format results for LLM context
const formattedSources = formatSearchResultsForLLM(searchResults.data);

// Generate response with LLM
const completion = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: 'Produce a concise answer based on the provided sources.'
    },
    {
      role: 'user',
      content: `Sources: ${formattedSources}\n\nQuery: 'What is the return policy?'`
    }
  ],
});
```

## Best Practices

1. **Use appropriate max_num_results**: Start with 10 and adjust based on your needs (max 50)
2. **Enable query rewriting**: Set `rewrite_query: true` for better results with natural language queries
3. **Set score thresholds**: Use `score_threshold` to filter out low-relevance results
4. **Filter by attributes**: Narrow results to specific jurisdictions, dates, or categories
5. **Handle pagination**: Check `has_more` and use `next_page` for large result sets
6. **Format for LLM**: Use `formatSearchResultsForLLM()` when synthesizing responses

## Testing Mode

When `AGENT_STUB_MODE=always` is set, the API returns mock data for testing without requiring OpenAI credentials.

## Related Documentation

- [Vector Embeddings Guide](./vector-embeddings.md)
- [File Search Tool](./file-search.md)
- [OpenAI Vector Stores](https://platform.openai.com/docs/assistants/tools/file-search)

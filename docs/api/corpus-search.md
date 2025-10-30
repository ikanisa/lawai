# Vector Store Search API

This document describes the new vector store search endpoint that implements the OpenAI Retrieval API.

## Endpoint

`POST /corpus/search`

## Description

Performs semantic search over documents in the configured vector store using OpenAI's Retrieval API.

## Request Body

The request body should be a JSON object with the following properties:

```typescript
{
  query: string;                    // Required: The search query (minimum 1 character)
  rewrite_query?: boolean;          // Optional: Enable automatic query rewriting for better results
  max_num_results?: number;         // Optional: Maximum results to return (1-50, default: 10)
  attribute_filter?: AttributeFilter; // Optional: Filter results by file attributes
  ranking_options?: RankingOptions;  // Optional: Configure result ranking
}
```

### AttributeFilter

Filter results based on file attributes. Supports both comparison and compound filters:

**Comparison Filter:**
```typescript
{
  type: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';
  key: string;
  value: string | number | boolean | Array<string | number | boolean>;
}
```

**Compound Filter:**
```typescript
{
  type: 'and' | 'or';
  filters: Array<ComparisonFilter | CompoundFilter>;
}
```

### RankingOptions

```typescript
{
  ranker?: 'auto' | 'default-2024-08-21';
  score_threshold?: number;  // 0.0 to 1.0
}
```

## Response

```typescript
{
  object: 'vector_store.search_results.page';
  search_query: string;        // The query used (may be rewritten if rewrite_query was true)
  data: Array<{
    file_id: string;
    filename: string;
    score: number;             // Relevance score
    attributes?: Record<string, string | number | boolean>;
    content: Array<{
      type: 'text';
      text: string;
    }>;
  }>;
  has_more: boolean;
  next_page: string | null;
}
```

## Examples

### Basic Search

```bash
curl -X POST http://localhost:3333/corpus/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the return policy?"
  }'
```

### Search with Query Rewriting

```bash
curl -X POST http://localhost:3333/corpus/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "I would like to know the height of the main office building",
    "rewrite_query": true
  }'
```

### Search with Attribute Filtering

```bash
curl -X POST http://localhost:3333/corpus/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "safety regulations",
    "attribute_filter": {
      "type": "eq",
      "key": "region",
      "value": "North America"
    }
  }'
```

### Search with Complex Filtering

```bash
curl -X POST http://localhost:3333/corpus/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "transport guidelines",
    "attribute_filter": {
      "type": "and",
      "filters": [
        {
          "type": "eq",
          "key": "region",
          "value": "North America"
        },
        {
          "type": "gte",
          "key": "date",
          "value": 1672531200
        }
      ]
    },
    "ranking_options": {
      "ranker": "auto",
      "score_threshold": 0.7
    },
    "max_num_results": 25
  }'
```

## Error Responses

### Invalid Request (400)

```json
{
  "error": "search_failed",
  "message": "Invalid search parameters: ..."
}
```

### Internal Error (500)

```json
{
  "error": "internal_error"
}
```

## Configuration

The endpoint requires the following environment variable to be set:

- `OPENAI_VECTOR_STORE_AUTHORITIES_ID`: The ID of the vector store to search

## Implementation Details

- Uses OpenAI's vector store search API
- Validates all parameters using Zod schemas
- Supports all OpenAI Retrieval API features including:
  - Query rewriting
  - Attribute filtering (comparison and compound)
  - Custom ranking options
  - Configurable result limits

## Related Files

- API Route: `apps/api/src/routes/corpus/index.ts`
- Data Layer: `apps/api/src/routes/corpus/data.ts`
- Types: `packages/shared/src/openai/vector-stores.ts`
- Schemas: `packages/shared/src/openai/vector-store-schemas.ts`
- Tests: `apps/api/test/corpus-search.test.ts`

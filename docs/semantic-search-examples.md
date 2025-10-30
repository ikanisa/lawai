# Semantic Search Examples

This document provides practical examples matching the specifications from the OpenAI Vector Stores documentation.

## Basic Search

Perform a simple semantic search query:

```typescript
const results = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "How many woodchucks are allowed per passenger?",
    max_num_results: 10
  })
});

const data = await results.json();
```

**Response:**
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

## Query Rewriting

Enable automatic query rewriting for improved results:

```typescript
const results = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "I'd like to know the height of the main office building.",
    rewrite_query: true
  })
});
```

**Query Transformations:**

| Original | Rewritten |
|----------|-----------|
| I'd like to know the height of the main office building. | primary office building height |
| What are the safety regulations for transporting hazardous materials? | safety regulations for hazardous materials |
| How do I file a complaint about a service issue? | service complaint filing process |

## Attribute Filtering

### Simple Comparison Filter

Filter by a specific region:

```typescript
const results = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "transport regulations",
    attribute_filter: {
      type: "eq",
      key: "region",
      value: "us"
    }
  })
});
```

### Date Range Filter

Find documents within a date range:

```typescript
const results = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "policy updates",
    attribute_filter: {
      type: "and",
      filters: [
        {
          type: "gte",
          key: "date",
          value: 1640995200  // Jan 1, 2022
        },
        {
          type: "lte",
          key: "date",
          value: 1672531199  // Dec 31, 2022
        }
      ]
    }
  })
});
```

### Filter by Filename

Include or exclude specific files:

```typescript
// Include specific filenames
const results = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "regulations",
    attribute_filter: {
      type: "in",
      key: "filename",
      value: ["policy_2023.pdf", "guidelines_v2.txt"]
    }
  })
});

// Exclude specific filenames
const results2 = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "regulations",
    attribute_filter: {
      type: "nin",
      key: "filename",
      value: ["draft.txt", "archive_old.pdf"]
    }
  })
});
```

### Complex Compound Filter

Combine multiple conditions with logical operators:

```typescript
const results = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "transport guidelines",
    attribute_filter: {
      type: "and",
      filters: [
        // Must be from US or North America region
        {
          type: "or",
          filters: [
            { type: "eq", key: "region", value: "us" },
            { type: "eq", key: "region", value: "North America" }
          ]
        },
        // Must be recent (after 2022)
        {
          type: "gte",
          key: "date",
          value: 1640995200
        },
        // Must be from Wildlife or Transport authority
        {
          type: "in",
          key: "author",
          value: ["Wildlife Department", "Transport Authority"]
        }
      ]
    }
  })
});
```

## Ranking Options

Tune result relevance using ranking options:

```typescript
const results = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: "woodchuck transport",
    ranking_options: {
      ranker: "auto",
      score_threshold: 0.75
    }
  })
});
```

This will:
- Use the automatic ranker for optimal performance
- Only return results with similarity score ≥ 0.75 (highly relevant)

## Synthesizing Responses with LLM

Complete workflow from search to LLM-generated response:

```typescript
// Step 1: Perform search
const userQuery = "What is the return policy?";

const searchResponse = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: userQuery,
    max_num_results: 5
  })
});

const searchResults = await searchResponse.json();

// Step 2: Format results for LLM
function formatResults(results) {
  let formatted = '<sources>';
  for (const result of results.data) {
    formatted += `<result file_id='${result.file_id}' file_name='${result.filename}'>`;
    for (const chunk of result.content) {
      formatted += `<content>${chunk.text}</content>`;
    }
    formatted += '</result>';
  }
  formatted += '</sources>';
  return formatted;
}

const formattedResults = formatResults(searchResults);

// Step 3: Generate LLM response
const completion = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: "gpt-4",
    messages: [
      {
        role: "developer",
        content: "Produce a concise answer to the query based on the provided sources."
      },
      {
        role: "user",
        content: `Sources: ${formattedResults}\n\nQuery: '${userQuery}'`
      }
    ]
  })
});

const result = await completion.json();
console.log(result.choices[0].message.content);
// Output: "Our return policy allows returns within 30 days of purchase."
```

## TypeScript SDK Examples

Using the shared package helpers:

```typescript
import {
  SearchRequestSchema,
  createComparisonFilter,
  createCompoundFilter,
  formatSearchResultsForLLM,
  type SearchRequest,
  type SearchResultsResponse
} from '@avocat-ai/shared';

// Create filters programmatically
const regionFilter = createComparisonFilter('region', 'eq', 'us');
const dateFilter = createComparisonFilter('date', 'gte', 1640995200);
const combinedFilter = createCompoundFilter('and', [regionFilter, dateFilter]);

// Build request
const request: SearchRequest = {
  query: "transport regulations",
  max_num_results: 10,
  attribute_filter: combinedFilter,
  ranking_options: {
    ranker: 'auto',
    score_threshold: 0.7
  }
};

// Validate request
const validated = SearchRequestSchema.parse(request);

// Make API call
const response = await fetch('/api/vector-stores/vs_abc123/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(validated)
});

const results: SearchResultsResponse = await response.json();

// Format for LLM
const llmContext = formatSearchResultsForLLM(results.data);
```

## Comparison: Keyword vs Semantic Search

Consider the query "When did we go to the moon?":

| Text | Keyword Similarity | Semantic Similarity |
|------|-------------------|---------------------|
| The first lunar landing occurred in July of 1969. | 0% | 65% |
| The first man on the moon was Neil Armstrong. | 27% | 43% |
| When I ate the moon cake, it was delicious. | 40% | 28% |

Semantic search correctly identifies the most relevant result despite having **no keyword overlap**.

## Pagination

Handle large result sets:

```typescript
let allResults = [];
let nextPage = null;

do {
  const response = await fetch('/api/vector-stores/vs_abc123/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: "regulations",
      max_num_results: 50,
      // Include next_page parameter if available
      ...(nextPage && { page: nextPage })
    })
  });

  const results = await response.json();
  allResults.push(...results.data);
  nextPage = results.next_page;
  
} while (nextPage);

console.log(`Total results: ${allResults.length}`);
```

## Best Practices

1. **Start with broad queries** - The semantic search will find relevant results
2. **Use query rewriting** - Enable for natural language queries
3. **Apply filters progressively** - Start without filters, then narrow down
4. **Set appropriate thresholds** - score_threshold of 0.7-0.8 works well for most cases
5. **Limit results** - 10-20 results usually sufficient for LLM context
6. **Format for LLM** - Use structured XML/JSON format for better LLM understanding

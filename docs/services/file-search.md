# File Search Service

The file search service provides semantic and keyword search capabilities across uploaded files using OpenAI's Responses API and vector stores.

## Overview

The file search functionality allows you to:
- Search across one or more vector stores
- Retrieve information from uploaded files with citations
- Filter results based on metadata
- Control the number of results returned
- Include search results in the response for debugging

## Basic Usage

```typescript
import { performFileSearch } from './services/file-search.js';

// Basic search
const result = await performFileSearch({
  query: 'What is deep research by OpenAI?',
  vectorStoreIds: ['vs_abc123'],
});

console.log(result.text); // AI-generated response
console.log(result.citations); // File citations with file_id and filename
console.log(result.searchCallId); // ID of the file search call
```

## Features

### Multiple Vector Stores

Search across multiple vector stores simultaneously:

```typescript
const result = await performFileSearch({
  query: 'Legal framework for data protection',
  vectorStoreIds: ['vs_laws', 'vs_regulations', 'vs_cases'],
});
```

### Limiting Results

Control the number of results to reduce token usage and latency:

```typescript
const result = await performFileSearch({
  query: 'Contract clauses',
  vectorStoreIds: ['vs_contracts'],
  maxNumResults: 2, // Return only top 2 results
});
```

### Metadata Filtering

Filter search results based on file metadata:

```typescript
const result = await performFileSearch({
  query: 'Product announcements',
  vectorStoreIds: ['vs_documents'],
  filters: {
    type: 'in',
    key: 'category',
    value: ['blog', 'announcement'],
  },
});
```

Supported filter types:
- `in` - Value must be in the provided array
- `eq` - Value must equal the provided value
- `ne` - Value must not equal the provided value
- `gt` - Value must be greater than the provided value
- `gte` - Value must be greater than or equal to the provided value
- `lt` - Value must be less than the provided value
- `lte` - Value must be less than or equal to the provided value

### Including Search Results

Include the raw search results for debugging or inspection:

```typescript
const result = await performFileSearch({
  query: 'Technical specifications',
  vectorStoreIds: ['vs_docs'],
  includeSearchResults: true,
});

// Access search results
for (const searchResult of result.searchResults || []) {
  console.log(`File: ${searchResult.filename}`);
  console.log(`Score: ${searchResult.score}`);
  console.log(`Content: ${searchResult.content}`);
}
```

### Custom Model

Use a specific model for the search:

```typescript
const result = await performFileSearch({
  query: 'Complex legal analysis',
  vectorStoreIds: ['vs_legal'],
  model: 'gpt-4.1',
});
```

### Logging

Pass a logger to track search operations:

```typescript
const logger = {
  info: (data, message) => console.log(message, data),
  warn: (data, message) => console.warn(message, data),
  error: (data, message) => console.error(message, data),
};

const result = await performFileSearch(
  {
    query: 'Search query',
    vectorStoreIds: ['vs_test'],
  },
  logger,
);
```

## Response Structure

### FileSearchResult

```typescript
interface FileSearchResult {
  text: string;                          // AI-generated response text
  citations: FileCitation[];             // File citations
  searchResults?: FileSearchResultItem[]; // Optional search results
  searchCallId?: string;                 // ID of the file search call
}
```

### FileCitation

```typescript
interface FileCitation {
  type: 'file_citation';
  index: number;      // Character index in the text where citation applies
  file_id: string;    // OpenAI file ID
  filename: string;   // Name of the cited file
}
```

### FileSearchResultItem

```typescript
interface FileSearchResultItem {
  file_id: string;
  filename?: string;
  score?: number;     // Relevance score
  content?: string;   // Excerpt from the file
}
```

## Error Handling

The service throws errors for various failure conditions:

```typescript
import { FILE_SEARCH_ERROR_CODES } from '@avocat-ai/shared';

try {
  const result = await performFileSearch({
    query: '',
    vectorStoreIds: ['vs_test'],
  });
} catch (error) {
  if (error.message === FILE_SEARCH_ERROR_CODES.INVALID_REQUEST) {
    console.error('Invalid request: empty query');
  } else if (error.message === FILE_SEARCH_ERROR_CODES.INVALID_VECTOR_STORE) {
    console.error('Invalid or missing vector store IDs');
  } else if (error.message === FILE_SEARCH_ERROR_CODES.QUOTA_EXCEEDED) {
    console.error('API quota exceeded');
  } else if (error.message === FILE_SEARCH_ERROR_CODES.VECTOR_STORE_ERROR) {
    console.error('Vector store access error');
  } else {
    console.error('API error:', error);
  }
}
```

## Vector Store ID Validation

Validate vector store IDs before using them:

```typescript
import { validateVectorStoreIds } from './services/file-search.js';

const ids = ['vs_valid123', 'invalid_id', 'vs_another'];
const { valid, invalid } = validateVectorStoreIds(ids);

console.log('Valid IDs:', valid);     // ['vs_valid123', 'vs_another']
console.log('Invalid IDs:', invalid); // ['invalid_id']
```

## Supported File Types

The file search tool supports the following file formats:

- **Code**: .c, .cpp, .cs, .go, .java, .js, .php, .py, .rb, .sh, .ts
- **Documents**: .doc, .docx, .pdf, .pptx, .tex, .txt
- **Data**: .css, .html, .json, .md

For text MIME types, the encoding must be UTF-8, UTF-16, or ASCII.

## Best Practices

1. **Use specific queries**: More specific queries return better results
2. **Limit results**: Use `maxNumResults` to reduce token usage for simple queries
3. **Filter metadata**: Use filters to narrow down results to relevant files
4. **Multiple stores**: Organize files into topic-specific vector stores for better performance
5. **Handle citations**: Use file citations to provide source attribution to users
6. **Log operations**: Enable logging in production for debugging and monitoring

## Integration with Existing Code

The file search service follows the same pattern as the web search service (`apps/api/src/services/web-search.ts`):

- Similar API structure
- Consistent error handling
- Compatible logging interface
- Parallel implementation approach

This makes it easy to use both services together or switch between them based on the use case.

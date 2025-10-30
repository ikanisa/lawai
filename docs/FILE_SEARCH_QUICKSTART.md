# File Search Feature - Quick Start

This guide provides a quick overview of the new file search functionality added to the Avocat-AI API.

## What's New

A new file search service that uses OpenAI's Responses API to search across uploaded files in vector stores. This complements the existing web search functionality and allows hybrid retrieval (internal documents + external web sources).

## Quick Usage

```typescript
import { performFileSearch } from '@apps/api/src/services/file-search.js';

const result = await performFileSearch({
  query: 'What is deep research by OpenAI?',
  vectorStoreIds: ['vs_abc123'],
});

console.log(result.text);       // AI-generated response
console.log(result.citations);  // File citations with sources
```

## Key Features

1. **Multiple Vector Stores** - Search across multiple knowledge bases
2. **Metadata Filtering** - Filter by file attributes (category, date, etc.)
3. **Result Limiting** - Control token usage with `maxNumResults`
4. **Citation Tracking** - Get file IDs and names for source attribution
5. **Search Results** - Optional raw search results for debugging

## Common Scenarios

### Basic Search
```typescript
const result = await performFileSearch({
  query: 'Contract law provisions',
  vectorStoreIds: ['vs_legal_docs'],
});
```

### Limited Results (reduce tokens)
```typescript
const result = await performFileSearch({
  query: 'Key terms',
  vectorStoreIds: ['vs_contracts'],
  maxNumResults: 2,
});
```

### Filtered Search
```typescript
const result = await performFileSearch({
  query: 'Recent announcements',
  vectorStoreIds: ['vs_docs'],
  filters: {
    type: 'in',
    key: 'category',
    value: ['blog', 'announcement'],
  },
});
```

### Combined Search (File + Web)
```typescript
import { performWebSearch } from '@apps/api/src/services/web-search.js';

// Internal documents
const internal = await performFileSearch({
  query: 'GDPR requirements',
  vectorStoreIds: ['vs_regulations'],
});

// External validation
const external = await performWebSearch({
  query: 'GDPR recent updates',
  allowedDomains: ['europa.eu'],
});

// Combine results...
```

## Files Added

- **Types**: `packages/shared/src/types/file-search.ts`
- **Service**: `apps/api/src/services/file-search.ts`
- **Tests**: `apps/api/test/file-search.test.ts`
- **Docs**: `docs/services/file-search.md`
- **Examples**: `docs/examples/file-search-integration.ts`

## Testing

Tests are located in `apps/api/test/file-search.test.ts` with 12 test cases covering:
- Basic searches
- Filtering and limiting
- Error handling
- Multiple vector stores
- Citation extraction

## Documentation

Full documentation: `docs/services/file-search.md`
Integration examples: `docs/examples/file-search-integration.ts`

## Environment Variables

Uses existing OpenAI configuration:
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_VECTOR_STORE_AUTHORITIES_ID` - Default vector store ID

## Error Handling

```typescript
import { FILE_SEARCH_ERROR_CODES } from '@avocat-ai/shared';

try {
  const result = await performFileSearch({...});
} catch (error) {
  if (error.message === FILE_SEARCH_ERROR_CODES.INVALID_REQUEST) {
    // Handle invalid request
  } else if (error.message === FILE_SEARCH_ERROR_CODES.INVALID_VECTOR_STORE) {
    // Handle invalid vector store
  } else if (error.message === FILE_SEARCH_ERROR_CODES.QUOTA_EXCEEDED) {
    // Handle quota exceeded
  }
}
```

## Pattern Consistency

The file search service follows the same pattern as the web search service:
- Similar function signatures
- Consistent error handling
- Compatible logger interface
- Parallel implementation approach

This makes it easy to:
- Switch between file and web search
- Use both services together
- Maintain consistent code style

## Integration

The service integrates seamlessly with existing code:
- Uses existing OpenAI client (`apps/api/src/openai.ts`)
- Exports types from shared package
- Works with existing logger interface
- No changes to existing code required

## Security

✅ All security checks passed:
- CodeQL scan: No vulnerabilities
- Input validation implemented
- Type safety enforced
- Error handling prevents information leakage

## Next Steps

1. Review the full documentation: `docs/services/file-search.md`
2. Explore examples: `docs/examples/file-search-integration.ts`
3. Run tests: `pnpm --filter @apps/api test file-search.test.ts`
4. Integrate into your application

## Support

For questions or issues:
- Review the comprehensive documentation
- Check the integration examples
- Refer to the test cases for usage patterns

---

**Implementation Date**: October 2025  
**Status**: ✅ Complete and tested  
**Version**: 1.0.0

/**
 * Example: Using File Search and Web Search Together
 * 
 * This example demonstrates how to use both file search (for internal documents)
 * and web search (for external information) in a legal AI application.
 */

import { performFileSearch } from '../../apps/api/src/services/file-search.js';
import { performWebSearch } from '../../apps/api/src/services/web-search.js';
import { FILE_SEARCH_ERROR_CODES, WEB_SEARCH_ERROR_CODES } from '@avocat-ai/shared';

// Example logger (replace with your actual logging implementation)
const logger = {
  info: (data: Record<string, unknown> | string, message?: string) => 
    console.log('[INFO]', message || data, typeof data === 'object' ? data : ''),
  warn: (data: Record<string, unknown> | string, message?: string) => 
    console.warn('[WARN]', message || data, typeof data === 'object' ? data : ''),
  error: (data: Record<string, unknown> | string, message?: string) => 
    console.error('[ERROR]', message || data, typeof data === 'object' ? data : ''),
};

/**
 * Scenario 1: Search internal legal documents
 */
async function searchInternalDocuments() {
  console.log('\n=== Searching Internal Documents ===\n');
  
  try {
    const result = await performFileSearch(
      {
        query: 'What are the key provisions of the data protection law?',
        vectorStoreIds: ['vs_legal_authorities', 'vs_case_law'],
        maxNumResults: 5,
        filters: {
          type: 'in',
          key: 'jurisdiction',
          value: ['FR', 'EU'],
        },
        includeSearchResults: true,
      },
      logger,
    );

    console.log('Response:', result.text);
    console.log('\nCitations:');
    for (const citation of result.citations) {
      console.log(`  - ${citation.filename} (${citation.file_id})`);
    }

    if (result.searchResults) {
      console.log('\nSearch Results:');
      for (const item of result.searchResults) {
        console.log(`  - ${item.filename} (score: ${item.score})`);
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === FILE_SEARCH_ERROR_CODES.INVALID_VECTOR_STORE) {
        console.error('Vector store not configured properly');
      } else {
        console.error('File search failed:', error.message);
      }
    }
  }
}

/**
 * Scenario 2: Search external web resources
 */
async function searchExternalResources() {
  console.log('\n=== Searching External Resources ===\n');
  
  try {
    const result = await performWebSearch(
      {
        query: 'Latest GDPR enforcement actions in France',
        allowedDomains: ['cnil.fr', 'europa.eu', 'legifrance.gouv.fr'],
        userLocation: {
          type: 'approximate',
          country: 'FR',
        },
      },
      logger,
    );

    console.log('Response:', result.text);
    console.log('\nSources:');
    for (const source of result.sources) {
      console.log(`  - ${source.title || 'Untitled'}: ${source.url}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === WEB_SEARCH_ERROR_CODES.DOMAIN_FILTER_ERROR) {
        console.error('Domain filtering issue');
      } else {
        console.error('Web search failed:', error.message);
      }
    }
  }
}

/**
 * Scenario 3: Combined search (internal documents + external validation)
 */
async function combinedSearch(query: string) {
  console.log('\n=== Combined Search: Internal + External ===\n');
  console.log('Query:', query);
  
  // First, search internal documents
  const internalResults = await performFileSearch(
    {
      query,
      vectorStoreIds: ['vs_legal_authorities'],
      maxNumResults: 3,
    },
    logger,
  );

  console.log('\n📚 Internal Documents:', internalResults.text.substring(0, 200) + '...');
  console.log('Citations:', internalResults.citations.length);

  // Then, search external resources for additional context
  const externalResults = await performWebSearch(
    {
      query: query + ' recent developments',
      allowedDomains: ['legifrance.gouv.fr', 'ohada.org'],
    },
    logger,
  );

  console.log('\n🌐 External Sources:', externalResults.text.substring(0, 200) + '...');
  console.log('Sources:', externalResults.sources.length);

  // Combine insights
  return {
    internal: {
      text: internalResults.text,
      citations: internalResults.citations,
    },
    external: {
      text: externalResults.text,
      sources: externalResults.sources,
    },
  };
}

/**
 * Scenario 4: Specialized search with metadata filtering
 */
async function searchByCategory() {
  console.log('\n=== Searching by Category (Metadata Filter) ===\n');
  
  // Search only blog posts and announcements
  const blogs = await performFileSearch(
    {
      query: 'AI policy updates',
      vectorStoreIds: ['vs_documents'],
      filters: {
        type: 'in',
        key: 'category',
        value: ['blog', 'announcement'],
      },
      maxNumResults: 2,
    },
    logger,
  );

  console.log('Blog Posts & Announcements:', blogs.citations.length, 'citations');

  // Search only technical documentation
  const technical = await performFileSearch(
    {
      query: 'API integration guide',
      vectorStoreIds: ['vs_documents'],
      filters: {
        type: 'eq',
        key: 'category',
        value: 'technical',
      },
      maxNumResults: 2,
    },
    logger,
  );

  console.log('Technical Docs:', technical.citations.length, 'citations');
}

/**
 * Scenario 5: Error handling and validation
 */
async function demonstrateErrorHandling() {
  console.log('\n=== Error Handling Examples ===\n');
  
  // Invalid vector store ID
  try {
    await performFileSearch({
      query: 'Test query',
      vectorStoreIds: ['invalid_id'], // Missing 'vs_' prefix
    });
  } catch (error) {
    console.log('✓ Caught invalid vector store ID error');
  }

  // Empty query
  try {
    await performFileSearch({
      query: '',
      vectorStoreIds: ['vs_test'],
    });
  } catch (error) {
    console.log('✓ Caught empty query error');
  }

  // Validate IDs before use
  const { validateVectorStoreIds } = await import('../../apps/api/src/services/file-search.js');
  const { valid, invalid } = validateVectorStoreIds(['vs_valid', 'invalid', 'vs_another']);
  
  console.log('Valid IDs:', valid);
  console.log('Invalid IDs:', invalid);
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60));
  console.log('File Search & Web Search Integration Examples');
  console.log('='.repeat(60));

  // Run examples (comment out as needed)
  await searchInternalDocuments();
  await searchExternalResources();
  await combinedSearch('Contract law in francophone jurisdictions');
  await searchByCategory();
  await demonstrateErrorHandling();

  console.log('\n' + '='.repeat(60));
  console.log('Examples completed!');
  console.log('='.repeat(60) + '\n');
}

// Uncomment to run examples
// main().catch(console.error);

export {
  searchInternalDocuments,
  searchExternalResources,
  combinedSearch,
  searchByCategory,
  demonstrateErrorHandling,
};

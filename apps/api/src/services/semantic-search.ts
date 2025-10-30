import type OpenAI from 'openai';
import type {
  SearchRequest,
  SearchResult,
  SearchResultsResponse,
  AttributeFilter,
  ComparisonFilter,
  CompoundFilter,
} from '@avocat-ai/shared';

/**
 * OpenAI Vector Store search response (based on OpenAI API)
 */
interface VectorStoreSearchResponse {
  object: string;
  data: Array<{
    file_id: string;
    filename?: string;
    score: number;
    attributes?: Record<string, unknown>;
    content: Array<{
      type: string;
      text: string;
    }>;
  }>;
  has_more?: boolean;
  next_page?: string | null;
}

/**
 * Convert our attribute filter format to OpenAI's format
 */
function convertAttributeFilter(filter: AttributeFilter): Record<string, unknown> {
  if ('type' in filter && ['and', 'or'].includes(filter.type)) {
    const compound = filter as CompoundFilter;
    return {
      [compound.type]: compound.filters.map((f) => convertAttributeFilter(f)),
    };
  }

  const comparison = filter as ComparisonFilter;
  return {
    [comparison.type]: {
      key: comparison.key,
      value: comparison.value,
    },
  };
}

/**
 * Perform semantic search on a vector store
 */
export async function searchVectorStore(
  client: OpenAI,
  vectorStoreId: string,
  request: SearchRequest
): Promise<SearchResultsResponse> {
  const vectorStoreApi = (client as any).beta?.vectorStores;
  
  if (!vectorStoreApi || typeof vectorStoreApi.search !== 'function') {
    throw new Error('vector_store_search_unavailable');
  }

  // Build search parameters
  const searchParams: Record<string, unknown> = {
    query: request.query,
    max_num_results: request.max_num_results,
  };

  if (request.rewrite_query !== undefined) {
    searchParams.rewrite_query = request.rewrite_query;
  }

  if (request.attribute_filter) {
    searchParams.attribute_filter = convertAttributeFilter(request.attribute_filter);
  }

  if (request.ranking_options) {
    searchParams.ranking_options = request.ranking_options;
  }

  // Perform search
  const response = (await vectorStoreApi.search(
    vectorStoreId,
    searchParams
  )) as VectorStoreSearchResponse;

  // Normalize response to our format
  const results: SearchResult[] = response.data.map((item) => ({
    file_id: item.file_id,
    filename: item.filename ?? item.file_id,
    score: item.score,
    attributes: item.attributes,
    content: item.content.map((chunk) => ({
      type: 'text' as const,
      text: chunk.text,
    })),
  }));

  // Return normalized response
  return {
    object: 'vector_store.search_results.page',
    search_query: request.query, // OpenAI may return rewritten query
    data: results,
    has_more: response.has_more ?? false,
    next_page: response.next_page ?? null,
  };
}

/**
 * Mock implementation for testing without OpenAI
 */
export function mockSearchVectorStore(
  vectorStoreId: string,
  request: SearchRequest
): SearchResultsResponse {
  const mockResults: SearchResult[] = [
    {
      file_id: 'file-mock-1',
      filename: 'legal_code_article_1132.txt',
      score: 0.85,
      attributes: {
        jurisdiction: 'OHADA',
        type: 'code',
        date: 1672531200,
      },
      content: [
        {
          type: 'text',
          text: "According to Article 1132, parties must execute contractual obligations in good faith.",
        },
        {
          type: 'text',
          text: "Prior notice is required before claiming damages for breach of contract.",
        },
      ],
    },
    {
      file_id: 'file-mock-2',
      filename: 'case_law_2022_046.txt',
      score: 0.73,
      attributes: {
        jurisdiction: 'OHADA',
        type: 'jurisprudence',
        date: 1652313600,
      },
      content: [
        {
          type: 'text',
          text: "The creditor must demonstrate the formal notice and the damages resulting from non-performance.",
        },
      ],
    },
  ];

  // Apply simple filtering if needed
  let filtered = mockResults;
  
  if (request.ranking_options?.score_threshold) {
    filtered = filtered.filter(
      (r) => r.score >= (request.ranking_options?.score_threshold ?? 0)
    );
  }

  // Limit results
  const limited = filtered.slice(0, request.max_num_results);

  return {
    object: 'vector_store.search_results.page',
    search_query: request.rewrite_query
      ? `${request.query} [rewritten]`
      : request.query,
    data: limited,
    has_more: limited.length < filtered.length,
    next_page: null,
  };
}

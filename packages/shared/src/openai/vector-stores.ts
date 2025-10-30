import type OpenAI from 'openai';

export interface VectorStoreFileParams {
  file_id: string;
}

// Comparison filter operators
export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin';

// Logical operators
export type LogicalOperator = 'and' | 'or';

// Comparison filter for attribute filtering
export interface ComparisonFilter {
  type: ComparisonOperator;
  key: string;
  value: string | number | boolean | Array<string | number | boolean>;
}

// Compound filter for combining multiple filters
export interface CompoundFilter {
  type: LogicalOperator;
  filters: Array<ComparisonFilter | CompoundFilter>;
}

// Attribute filter can be either comparison or compound
export type AttributeFilter = ComparisonFilter | CompoundFilter;

// Ranking options for search
export interface RankingOptions {
  ranker?: 'auto' | 'default-2024-08-21';
  score_threshold?: number;
}

// Chunking strategy for files
export interface ChunkingStrategy {
  type: 'static';
  max_chunk_size_tokens: number;
  chunk_overlap_tokens: number;
}

// Content item in search results
export interface SearchContentItem {
  type: 'text';
  text: string;
}

// Individual search result
export interface SearchResult {
  file_id: string;
  filename: string;
  score: number;
  attributes?: Record<string, string | number | boolean>;
  content: SearchContentItem[];
}

// Search results page
export interface SearchResultsPage {
  object: 'vector_store.search_results.page';
  search_query: string;
  data: SearchResult[];
  has_more: boolean;
  next_page: string | null;
}

// Search parameters
export interface SearchParams {
  query: string;
  rewrite_query?: boolean;
  attribute_filter?: AttributeFilter;
  ranking_options?: RankingOptions;
  max_num_results?: number;
}

export interface VectorStoreApi {
  retrieve(id: string): Promise<{ id: string }>;
  create(params: { name: string }): Promise<{ id: string }>;
  search?(vectorStoreId: string, params: SearchParams): Promise<SearchResultsPage>;
  files: {
    create(vectorStoreId: string, params: VectorStoreFileParams): Promise<unknown>;
  };
}

function getBetaNamespace(client: OpenAI): unknown {
  return (client as OpenAI & { beta?: unknown }).beta;
}

export function getVectorStoreApi(client: OpenAI): VectorStoreApi {
  const beta = getBetaNamespace(client);
  const vectorStores = (beta as { vectorStores?: VectorStoreApi } | undefined)?.vectorStores;
  if (!vectorStores) {
    throw new Error('Vector store API is not available on this OpenAI client');
  }
  return vectorStores;
}

export function tryGetVectorStoreApi(client: OpenAI): VectorStoreApi | null {
  try {
    return getVectorStoreApi(client);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Vector store API')) {
      return null;
    }
    throw error;
  }
}

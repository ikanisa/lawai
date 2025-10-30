import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchVectorStore } from '../src/routes/corpus/data.js';
import * as shared from '@avocat-ai/shared';

// Mock the shared module
vi.mock('@avocat-ai/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@avocat-ai/shared')>();
  return {
    ...actual,
    getOpenAIClient: vi.fn(),
    getVectorStoreApi: vi.fn(),
  };
});

// Mock the config
vi.mock('../src/config.js', () => ({
  env: {
    OPENAI_API_KEY: 'sk-test-key',
    OPENAI_VECTOR_STORE_AUTHORITIES_ID: 'vs_test123',
  },
}));

describe('searchVectorStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should validate and perform a basic search', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      object: 'vector_store.search_results.page',
      search_query: 'test query',
      data: [
        {
          file_id: 'file-123',
          filename: 'test.pdf',
          score: 0.85,
          content: [
            {
              type: 'text',
              text: 'This is test content',
            },
          ],
        },
      ],
      has_more: false,
      next_page: null,
    });

    const mockVectorStoreApi = {
      retrieve: vi.fn(),
      create: vi.fn(),
      search: mockSearch,
      files: {
        create: vi.fn(),
      },
    };

    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({} as any);
    vi.spyOn(shared, 'getVectorStoreApi').mockReturnValue(mockVectorStoreApi);

    const result = await searchVectorStore({
      query: 'test query',
    });

    expect(result).toBeDefined();
    expect(result.object).toBe('vector_store.search_results.page');
    expect(result.search_query).toBe('test query');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].file_id).toBe('file-123');
    expect(mockSearch).toHaveBeenCalledWith('vs_test123', {
      query: 'test query',
    });
  });

  it('should support query rewriting', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      object: 'vector_store.search_results.page',
      search_query: 'rewritten query',
      data: [],
      has_more: false,
      next_page: null,
    });

    const mockVectorStoreApi = {
      retrieve: vi.fn(),
      create: vi.fn(),
      search: mockSearch,
      files: {
        create: vi.fn(),
      },
    };

    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({} as any);
    vi.spyOn(shared, 'getVectorStoreApi').mockReturnValue(mockVectorStoreApi);

    await searchVectorStore({
      query: 'original query',
      rewrite_query: true,
    });

    expect(mockSearch).toHaveBeenCalledWith('vs_test123', {
      query: 'original query',
      rewrite_query: true,
    });
  });

  it('should support attribute filtering', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      object: 'vector_store.search_results.page',
      search_query: 'filtered query',
      data: [],
      has_more: false,
      next_page: null,
    });

    const mockVectorStoreApi = {
      retrieve: vi.fn(),
      create: vi.fn(),
      search: mockSearch,
      files: {
        create: vi.fn(),
      },
    };

    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({} as any);
    vi.spyOn(shared, 'getVectorStoreApi').mockReturnValue(mockVectorStoreApi);

    const attributeFilter = {
      type: 'eq' as const,
      key: 'region',
      value: 'North America',
    };

    await searchVectorStore({
      query: 'filtered query',
      attribute_filter: attributeFilter,
    });

    expect(mockSearch).toHaveBeenCalledWith('vs_test123', {
      query: 'filtered query',
      attribute_filter: attributeFilter,
    });
  });

  it('should support ranking options', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      object: 'vector_store.search_results.page',
      search_query: 'ranked query',
      data: [],
      has_more: false,
      next_page: null,
    });

    const mockVectorStoreApi = {
      retrieve: vi.fn(),
      create: vi.fn(),
      search: mockSearch,
      files: {
        create: vi.fn(),
      },
    };

    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({} as any);
    vi.spyOn(shared, 'getVectorStoreApi').mockReturnValue(mockVectorStoreApi);

    await searchVectorStore({
      query: 'ranked query',
      ranking_options: {
        ranker: 'auto',
        score_threshold: 0.7,
      },
    });

    expect(mockSearch).toHaveBeenCalledWith('vs_test123', {
      query: 'ranked query',
      ranking_options: {
        ranker: 'auto',
        score_threshold: 0.7,
      },
    });
  });

  it('should validate max_num_results within range', async () => {
    const mockSearch = vi.fn().mockResolvedValue({
      object: 'vector_store.search_results.page',
      search_query: 'test query',
      data: [],
      has_more: false,
      next_page: null,
    });

    const mockVectorStoreApi = {
      retrieve: vi.fn(),
      create: vi.fn(),
      search: mockSearch,
      files: {
        create: vi.fn(),
      },
    };

    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({} as any);
    vi.spyOn(shared, 'getVectorStoreApi').mockReturnValue(mockVectorStoreApi);

    await searchVectorStore({
      query: 'test query',
      max_num_results: 25,
    });

    expect(mockSearch).toHaveBeenCalledWith('vs_test123', {
      query: 'test query',
      max_num_results: 25,
    });
  });

  it('should reject invalid max_num_results', async () => {
    await expect(
      searchVectorStore({
        query: 'test query',
        max_num_results: 100, // exceeds max of 50
      })
    ).rejects.toThrow('Invalid search parameters');
  });

  it('should reject empty query', async () => {
    await expect(
      searchVectorStore({
        query: '',
      })
    ).rejects.toThrow('Invalid search parameters');
  });

  it('should throw error when vector store ID is not configured', async () => {
    // Mock env without vector store ID
    vi.doMock('../src/config.js', () => ({
      env: {
        OPENAI_API_KEY: 'sk-test-key',
        OPENAI_VECTOR_STORE_AUTHORITIES_ID: '',
      },
    }));

    await expect(
      searchVectorStore({
        query: 'test query',
      })
    ).rejects.toThrow('Vector store ID is not configured');
  });

  it('should throw error when search is not supported', async () => {
    const mockVectorStoreApiWithoutSearch = {
      retrieve: vi.fn(),
      create: vi.fn(),
      // No search method
      files: {
        create: vi.fn(),
      },
    };

    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({} as any);
    vi.spyOn(shared, 'getVectorStoreApi').mockReturnValue(mockVectorStoreApiWithoutSearch as any);

    await expect(
      searchVectorStore({
        query: 'test query',
      })
    ).rejects.toThrow('Vector store search is not supported');
  });
});

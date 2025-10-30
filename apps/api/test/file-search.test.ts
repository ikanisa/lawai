import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_SEARCH_ERROR_CODES } from '@avocat-ai/shared';

const responsesCreateMock = vi.fn();
const logOpenAIDebugMock = vi.fn();

vi.mock('../src/openai.js', () => ({
  getOpenAI: () => ({
    responses: { create: responsesCreateMock },
  }),
  logOpenAIDebug: logOpenAIDebugMock,
}));

import { performFileSearch, validateVectorStoreIds } from '../src/services/file-search.js';

describe('performFileSearch', () => {
  beforeEach(() => {
    responsesCreateMock.mockClear();
    logOpenAIDebugMock.mockClear();
  });

  it('performs basic file search with vector store', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      output: [
        {
          type: 'file_search_call',
          id: 'fs_test123',
          status: 'completed',
          queries: ['test query'],
          search_results: null,
        },
        {
          type: 'message',
          id: 'msg_test456',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: 'This is a test response based on the files.',
              annotations: [
                {
                  type: 'file_citation',
                  index: 10,
                  file_id: 'file-abc123',
                  filename: 'test.pdf',
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await performFileSearch({
      query: 'What is the legal framework?',
      vectorStoreIds: ['vs_test123'],
    });

    expect(result.text).toBe('This is a test response based on the files.');
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      type: 'file_citation',
      file_id: 'file-abc123',
      filename: 'test.pdf',
    });
    expect(result.searchCallId).toBe('fs_test123');

    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          {
            type: 'file_search',
            vector_store_ids: ['vs_test123'],
          },
        ],
        tool_choice: { type: 'tool', function: { name: 'file_search' } },
      }),
    );
  });

  it('includes search results when requested', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      output: [
        {
          type: 'file_search_call',
          id: 'fs_results123',
          status: 'completed',
          queries: ['deep research'],
          search_results: [
            {
              file_id: 'file-xyz789',
              filename: 'research.pdf',
              score: 0.95,
              content: 'Relevant excerpt from the document...',
            },
          ],
        },
        {
          type: 'message',
          id: 'msg_test789',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: 'Based on the research...',
            },
          ],
        },
      ],
    });

    const result = await performFileSearch({
      query: 'What is deep research?',
      vectorStoreIds: ['vs_authorities'],
      includeSearchResults: true,
    });

    expect(result.searchResults).toHaveLength(1);
    expect(result.searchResults?.[0]).toMatchObject({
      file_id: 'file-xyz789',
      filename: 'research.pdf',
      score: 0.95,
    });

    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        include: ['file_search_call.results'],
      }),
    );
  });

  it('supports max_num_results parameter', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      output: [
        {
          type: 'file_search_call',
          id: 'fs_limited',
          status: 'completed',
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Limited results' }],
        },
      ],
    });

    await performFileSearch({
      query: 'Test query',
      vectorStoreIds: ['vs_test'],
      maxNumResults: 2,
    });

    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            type: 'file_search',
            max_num_results: 2,
          }),
        ],
      }),
    );
  });

  it('supports metadata filtering', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      output: [
        {
          type: 'file_search_call',
          id: 'fs_filtered',
          status: 'completed',
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Filtered results' }],
        },
      ],
    });

    await performFileSearch({
      query: 'Search with filter',
      vectorStoreIds: ['vs_test'],
      filters: {
        type: 'in',
        key: 'category',
        value: ['blog', 'announcement'],
      },
    });

    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            filters: {
              type: 'in',
              key: 'category',
              value: ['blog', 'announcement'],
            },
          }),
        ],
      }),
    );
  });

  it('handles multiple vector stores', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      output: [
        {
          type: 'file_search_call',
          id: 'fs_multi',
          status: 'completed',
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Multi-store results' }],
        },
      ],
    });

    await performFileSearch({
      query: 'Search across stores',
      vectorStoreIds: ['vs_store1', 'vs_store2', 'vs_store3'],
    });

    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: [
          expect.objectContaining({
            vector_store_ids: ['vs_store1', 'vs_store2', 'vs_store3'],
          }),
        ],
      }),
    );
  });

  it('throws error for empty query', async () => {
    await expect(
      performFileSearch({
        query: '',
        vectorStoreIds: ['vs_test'],
      }),
    ).rejects.toThrow(FILE_SEARCH_ERROR_CODES.INVALID_REQUEST);
  });

  it('throws error for empty vector store list', async () => {
    await expect(
      performFileSearch({
        query: 'Test',
        vectorStoreIds: [],
      }),
    ).rejects.toThrow(FILE_SEARCH_ERROR_CODES.INVALID_VECTOR_STORE);
  });

  it('extracts multiple file citations from response', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      output: [
        {
          type: 'file_search_call',
          id: 'fs_multi_cite',
          status: 'completed',
        },
        {
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'output_text',
              text: 'Response with multiple citations',
              annotations: [
                {
                  type: 'file_citation',
                  index: 992,
                  file_id: 'file-abc',
                  filename: 'doc1.pdf',
                },
                {
                  type: 'file_citation',
                  index: 1176,
                  file_id: 'file-def',
                  filename: 'doc2.pdf',
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await performFileSearch({
      query: 'Multi-citation query',
      vectorStoreIds: ['vs_test'],
    });

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0].file_id).toBe('file-abc');
    expect(result.citations[1].file_id).toBe('file-def');
  });

  it('handles API errors gracefully', async () => {
    const apiError = new Error('API quota exceeded');
    responsesCreateMock.mockRejectedValueOnce(apiError);

    await expect(
      performFileSearch({
        query: 'Test',
        vectorStoreIds: ['vs_test'],
      }),
    ).rejects.toThrow('API quota exceeded');

    expect(logOpenAIDebugMock).toHaveBeenCalledWith('file_search', apiError, undefined);
  });

  it('uses custom model when provided', async () => {
    responsesCreateMock.mockResolvedValueOnce({
      output: [
        {
          type: 'file_search_call',
          id: 'fs_custom_model',
          status: 'completed',
        },
        {
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'Custom model response' }],
        },
      ],
    });

    await performFileSearch({
      query: 'Test',
      vectorStoreIds: ['vs_test'],
      model: 'gpt-4.1',
    });

    expect(responsesCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4.1',
      }),
    );
  });
});

describe('validateVectorStoreIds', () => {
  it('validates correct vector store IDs', () => {
    const { valid, invalid } = validateVectorStoreIds([
      'vs_abc123',
      'vs_DEF456',
      'vs_test789',
    ]);

    expect(valid).toHaveLength(3);
    expect(invalid).toHaveLength(0);
  });

  it('identifies invalid vector store IDs', () => {
    const { valid, invalid } = validateVectorStoreIds([
      'vs_valid123',
      'invalid_format',
      'vs_',
      'not-a-vs',
      '',
    ]);

    expect(valid).toEqual(['vs_valid123']);
    expect(invalid).toHaveLength(4);
  });

  it('trims whitespace from IDs', () => {
    const { valid, invalid } = validateVectorStoreIds([
      '  vs_trimmed123  ',
      'vs_notrimmed456',
    ]);

    expect(valid).toEqual(['vs_trimmed123', 'vs_notrimmed456']);
    expect(invalid).toHaveLength(0);
  });
});

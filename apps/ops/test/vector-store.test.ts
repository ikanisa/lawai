import { afterEach, describe, expect, it, vi } from 'vitest';
import * as shared from '@avocat-ai/shared';
import { chunkText } from '../src/lib/embeddings.js';
import { validateVectorStore } from '../src/lib/vector-store.js';
import { getOpenAIClient, SearchParamsSchema } from '@avocat-ai/shared';

vi.mock('@avocat-ai/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@avocat-ai/shared')>();
  return {
    ...actual,
    getOpenAIClient: vi.fn(),
  };
});

describe('validateVectorStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when id is empty', async () => {
    const result = await validateVectorStore('sk-test', '');
    expect(result).toBe(false);
  });

  const mockedClient = vi.mocked(getOpenAIClient);

  it('returns true when OpenAI responds with 200', async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: 'vs_123' });
    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({
      beta: { vectorStores: { retrieve } },
    } as unknown as { beta: { vectorStores: { retrieve: typeof retrieve } } });

    await expect(validateVectorStore('sk-test', 'vs_123')).resolves.toBe(true);
    expect(retrieve).toHaveBeenCalledWith('vs_123');
  });

  it('returns false when OpenAI returns 404', async () => {
    const retrieve = vi.fn().mockRejectedValue({ status: 404 });
    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({
      beta: { vectorStores: { retrieve } },
    } as unknown as { beta: { vectorStores: { retrieve: typeof retrieve } } });

    await expect(validateVectorStore('sk-test', 'vs_missing')).resolves.toBe(false);
    expect(retrieve).toHaveBeenCalledWith('vs_missing');
  });

  it('throws on other OpenAI errors', async () => {
    const retrieve = vi.fn().mockRejectedValue(new Error('Upstream failure'));
    vi.spyOn(shared, 'getOpenAIClient').mockReturnValue({
      beta: { vectorStores: { retrieve } },
    } as unknown as { beta: { vectorStores: { retrieve: typeof retrieve } } });

    await expect(validateVectorStore('sk-test', 'vs_fail')).rejects.toThrow('Upstream failure');
    expect(retrieve).toHaveBeenCalledWith('vs_fail');
  });
});

describe('chunkText article markers', () => {
  it('detects article markers when present', () => {
    const text = 'Article 45 — Cette disposition s’applique immédiatement. Elle couvre plusieurs obligations.';
    const chunks = chunkText(text, 200, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].marker).toMatch(/Article 45/i);
  });

  it('returns null marker when no labels are present', () => {
    const text = 'Ce document de synthèse ne contient aucun identifiant d’article.';
    const chunks = chunkText(text, 200, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].marker).toBeNull();
  });
});

describe('SearchParamsSchema', () => {
  it('validates basic search parameters', () => {
    const result = SearchParamsSchema.safeParse({
      query: 'test query',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe('test query');
    }
  });

  it('validates search parameters with all optional fields', () => {
    const result = SearchParamsSchema.safeParse({
      query: 'test query',
      rewrite_query: true,
      max_num_results: 25,
      attribute_filter: {
        type: 'eq',
        key: 'region',
        value: 'North America',
      },
      ranking_options: {
        ranker: 'auto',
        score_threshold: 0.75,
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects empty query', () => {
    const result = SearchParamsSchema.safeParse({
      query: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects max_num_results above 50', () => {
    const result = SearchParamsSchema.safeParse({
      query: 'test',
      max_num_results: 100,
    });

    expect(result.success).toBe(false);
  });

  it('rejects score_threshold above 1.0', () => {
    const result = SearchParamsSchema.safeParse({
      query: 'test',
      ranking_options: {
        score_threshold: 1.5,
      },
    });

    expect(result.success).toBe(false);
  });

  it('validates compound attribute filters', () => {
    const result = SearchParamsSchema.safeParse({
      query: 'test query',
      attribute_filter: {
        type: 'and',
        filters: [
          {
            type: 'eq',
            key: 'region',
            value: 'North America',
          },
          {
            type: 'gte',
            key: 'date',
            value: 1672531200,
          },
        ],
      },
    });

    expect(result.success).toBe(true);
  });
});

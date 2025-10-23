import { afterEach, describe, expect, it, vi } from 'vitest';
import { chunkText } from '../src/lib/embeddings.js';
import { validateVectorStore } from '../src/lib/vector-store.js';
import { getOpenAIClient } from '@avocat-ai/shared';

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
    mockedClient.mockReturnValue({
      beta: {
        vectorStores: {
          retrieve: vi.fn(async () => ({ id: 'vs_123' })),
        },
      },
    } as unknown as ReturnType<typeof getOpenAIClient>);

    await expect(validateVectorStore('sk-test', 'vs_123')).resolves.toBe(true);
  });

  it('returns false when OpenAI returns 404', async () => {
    mockedClient.mockReturnValue({
      beta: {
        vectorStores: {
          retrieve: vi.fn(async () => {
            const error = new Error('Not found');
            (error as { status?: number }).status = 404;
            throw error;
          }),
        },
      },
    } as unknown as ReturnType<typeof getOpenAIClient>);

    await expect(validateVectorStore('sk-test', 'vs_missing')).resolves.toBe(false);
  });

  it('throws on other OpenAI errors', async () => {
    mockedClient.mockReturnValue({
      beta: {
        vectorStores: {
          retrieve: vi.fn(async () => {
            throw new Error('Upstream failure');
          }),
        },
      },
    } as unknown as ReturnType<typeof getOpenAIClient>);

    await expect(validateVectorStore('sk-test', 'vs_fail')).rejects.toThrow('Upstream failure');
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

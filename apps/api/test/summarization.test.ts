import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const encoder = new TextEncoder();

const openAIResponsesCreateMock = vi.fn();
const openAIEmbeddingsCreateMock = vi.fn();
const getOpenAIClientMock = vi.fn(() => ({
  responses: { create: openAIResponsesCreateMock },
  embeddings: { create: openAIEmbeddingsCreateMock },
}));
const fetchOpenAIDebugDetailsMock = vi.fn();
const isOpenAIDebugEnabledMock = vi.fn(() => false);

vi.mock('@avocat-ai/shared', async () => {
  const actual = await vi.importActual<typeof import('@avocat-ai/shared')>('@avocat-ai/shared');
  return {
    ...actual,
    getOpenAIClient: getOpenAIClientMock,
    fetchOpenAIDebugDetails: fetchOpenAIDebugDetailsMock,
    isOpenAIDebugEnabled: isOpenAIDebugEnabledMock,
  };
});

describe('summariseDocumentFromPayload', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AGENT_MODEL = 'gpt-test';
    process.env.EMBEDDING_MODEL = 'text-embedding-test';
    process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'vs_test';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    process.env.AGENT_STUB_MODE = 'never';
    process.env.SUMMARISER_MODEL = 'gpt-summary';
    process.env.MAX_SUMMARY_CHARS = '8000';
    openAIResponsesCreateMock.mockReset();
    openAIEmbeddingsCreateMock.mockReset();
    getOpenAIClientMock.mockReturnValue({
      responses: { create: openAIResponsesCreateMock },
      embeddings: { create: openAIEmbeddingsCreateMock },
    });
    openAIResponsesCreateMock.mockResolvedValue({ output: [], output_text: '' });
    openAIEmbeddingsCreateMock.mockResolvedValue({ data: [] });
    fetchOpenAIDebugDetailsMock.mockResolvedValue(null);
    isOpenAIDebugEnabledMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUMMARISER_MODEL;
    delete process.env.MAX_SUMMARY_CHARS;
  });

  it('skips when the extracted text is too short', async () => {
    const { summariseDocumentFromPayload } = await import('../src/summarization.ts');

    const payload = encoder.encode('Bref');
    const result = await summariseDocumentFromPayload({
      payload,
      mimeType: 'text/plain',
      metadata: { title: 'Note', jurisdiction: 'FR', publisher: 'Légifrance' },
      openaiApiKey: 'test-key',
    });

    expect(result.status).toBe('skipped');
    expect(result.error).toBe('Texte exploitable indisponible');
    expect(result.chunks).toHaveLength(0);
  });

  it('returns ready when OpenAI summary and embeddings succeed', async () => {
    const text = 'Article 12 — Les dispositions relatives aux sûretés sont applicables. '.repeat(5);
    const structured = JSON.stringify({
      summary: 'Synthèse',
      highlights: [
        { heading: 'Objet', detail: 'Dispositions applicables.' },
        { heading: 'Dates', detail: 'Entrée en vigueur immédiate.' },
      ],
    });
    const responsesReply = {
      output: [
        {
          content: [
            {
              text: structured,
            },
          ],
        },
      ],
      output_text: structured,
    };

    const embeddingsReply = {
      data: [
        { embedding: new Array(3072).fill(0.2) },
      ],
    };

    openAIResponsesCreateMock.mockResolvedValue(responsesReply);
    openAIEmbeddingsCreateMock.mockResolvedValue(embeddingsReply);

    const { summariseDocumentFromPayload } = await import('../src/summarization.ts');

    const result = await summariseDocumentFromPayload({
      payload: encoder.encode(text),
      mimeType: 'text/plain',
      metadata: { title: 'Acte', jurisdiction: 'OHADA', publisher: 'OHADA' },
      openaiApiKey: 'test-key',
      summariserModel: 'gpt-summary',
      embeddingModel: 'text-embedding-test',
      maxSummaryChars: 4000,
    });

    expect(openAIResponsesCreateMock).toHaveBeenCalledTimes(1);
    expect(openAIEmbeddingsCreateMock).toHaveBeenCalledTimes(Math.ceil(result.chunks.length / 16));
    expect(result.status).toBe('ready');
    expect(result.summary).toBe('Synthèse');
    expect(result.highlights).toHaveLength(2);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].marker).toMatch(/Article 12/i);
    expect(result.embeddings).toHaveLength(result.chunks.length);
  });

  it('falls back to response.output when output_text is missing', async () => {
    const text = 'Article 1 — Les dispositions relatives aux contrats sont détaillées. '.repeat(5);
    const structured = JSON.stringify({
      summary: 'Résumé alternatif',
      highlights: [
        { heading: 'Objet', detail: 'Détails des contrats.' },
      ],
    });

    openAIResponsesCreateMock.mockResolvedValue({
      output: [
        {
          content: [
            {
              text: structured,
            },
          ],
        },
      ],
      output_text: '',
    });

    const { summariseDocumentFromPayload } = await import('../src/summarization.ts');

    const result = await summariseDocumentFromPayload({
      payload: encoder.encode(text),
      mimeType: 'text/plain',
      metadata: { title: 'Contrat', jurisdiction: 'FR', publisher: 'Légifrance' },
      openaiApiKey: 'test-key',
      summariserModel: 'gpt-summary',
      embeddingModel: 'text-embedding-test',
      maxSummaryChars: 4000,
    });

    expect(result.status).toBe('ready');
    expect(result.summary).toBe('Résumé alternatif');
    expect(result.highlights).toHaveLength(1);
  });

  it('returns failed when the summary call errors', async () => {
    const quotaError = new Error('quota exceeded');
    openAIResponsesCreateMock.mockRejectedValue(quotaError);

    const { summariseDocumentFromPayload } = await import('../src/summarization.ts');

    const result = await summariseDocumentFromPayload({
      payload: encoder.encode('Article 1 — Long texte '.repeat(20)),
      mimeType: 'text/plain',
      metadata: { title: 'Code', jurisdiction: 'FR', publisher: 'Légifrance' },
      openaiApiKey: 'test-key',
    });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('quota exceeded');
    expect(result.embeddings).toHaveLength(0);
  });
});

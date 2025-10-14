import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const encoder = new TextEncoder();
describe('summariseDocumentFromPayload', () => {
    beforeEach(() => {
        vi.resetModules();
        process.env.OPENAI_API_KEY = 'test-key';
        process.env.AGENT_MODEL = 'gpt-test';
        process.env.EMBEDDING_MODEL = 'text-embedding-test';
        process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'vs_test';
        process.env.SUPABASE_URL = 'https://example.supabase.co';
        process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
        process.env.AGENT_STUB_MODE = 'never';
        process.env.SUMMARISER_MODEL = 'gpt-summary';
        process.env.MAX_SUMMARY_CHARS = '8000';
    });
    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.SUMMARISER_MODEL;
        delete process.env.MAX_SUMMARY_CHARS;
    });
    it('skips when the extracted text is too short', async () => {
        const { summariseDocumentFromPayload } = await import('../src/summarization.js');
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
        const responsesReply = {
            output: [
                {
                    content: [
                        {
                            text: JSON.stringify({
                                summary: 'Synthèse',
                                highlights: [
                                    { heading: 'Objet', detail: 'Dispositions applicables.' },
                                    { heading: 'Dates', detail: 'Entrée en vigueur immédiate.' },
                                ],
                            }),
                        },
                    ],
                },
            ],
        };
        const embeddingsReply = {
            data: [
                { embedding: new Array(3072).fill(0.2) },
            ],
        };
        const fetchMock = vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
            const url = typeof input === 'string' ? input : input.toString();
            if (url.includes('/responses')) {
                return new Response(JSON.stringify(responsesReply), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            if (url.includes('/embeddings')) {
                return new Response(JSON.stringify(embeddingsReply), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            throw new Error(`Unexpected fetch ${url}`);
        });
        const { summariseDocumentFromPayload } = await import('../src/summarization.js');
        const result = await summariseDocumentFromPayload({
            payload: encoder.encode(text),
            mimeType: 'text/plain',
            metadata: { title: 'Acte', jurisdiction: 'OHADA', publisher: 'OHADA' },
            openaiApiKey: 'test-key',
            summariserModel: 'gpt-summary',
            embeddingModel: 'text-embedding-test',
            maxSummaryChars: 4000,
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.status).toBe('ready');
        expect(result.summary).toBe('Synthèse');
        expect(result.highlights).toHaveLength(2);
        expect(result.chunks.length).toBeGreaterThan(0);
        expect(result.chunks[0].marker).toMatch(/Article 12/i);
        expect(result.embeddings).toHaveLength(result.chunks.length);
    });
    it('returns failed when the summary call errors', async () => {
        vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { message: 'quota exceeded' } }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
        }));
        const { summariseDocumentFromPayload } = await import('../src/summarization.js');
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

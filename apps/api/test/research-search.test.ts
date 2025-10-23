import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

import { createApp } from '../src/app.js';
import { resetOpenAIClientFactories, setVectorStoreClientFactory } from '../src/openai.js';

interface ResearchDocument {
  id: string;
  title: string;
  href: string;
  snippet: string;
  entryIntoForce: 'current' | 'future';
  publicationDateBucket: 'last-12-months' | 'last-5-years' | 'all';
  publicationDate: string;
  type: string;
  baseScore: number;
}

const corpus: ResearchDocument[] = [
  {
    id: 'doc-ausgie-1132',
    title: 'AUSCGIE art. 1132 — Inexécution contractuelle',
    href: 'https://www.ohada.org/actes-uniformes/ausgie#article1132',
    snippet:
      "L'Acte uniforme impose l'exécution de bonne foi et encadre les sanctions en cas d'inexécution contractuelle.",
    entryIntoForce: 'current',
    publicationDateBucket: 'last-12-months',
    publicationDate: '2024-02-19',
    type: 'Officiel',
    baseScore: 0.93,
  },
  {
    id: 'doc-ccja-2022-046',
    title: 'CCJA, 3e ch., 12 mai 2022, n° 046/2022',
    href: 'https://juris.ohada.org/ccja/2022/046',
    snippet:
      "La CCJA rappelle la charge de la preuve et sanctionne le débiteur pour absence de mise en demeure suffisante.",
    entryIntoForce: 'current',
    publicationDateBucket: 'last-5-years',
    publicationDate: '2022-05-12',
    type: 'Jurisprudence',
    baseScore: 0.87,
  },
  {
    id: 'doc-jo-ohada-2025-01',
    title: 'Journal Officiel OHADA — Avis 2025/01',
    href: 'https://www.ohada.org/jo/2025/01',
    snippet: 'Annonce des nouvelles dispositions différées relatives aux clauses résolutoires.',
    entryIntoForce: 'future',
    publicationDateBucket: 'all',
    publicationDate: '2025-01-05',
    type: 'Consolidé',
    baseScore: 0.8,
  },
];

function createVectorStoreMock() {
  return {
    async query({ query, limit, filters }: { query: string; limit: number; filters?: Record<string, string[]> }) {
      const normalizedFilters = filters ?? {};
      const filtered = corpus
        .filter((document) => {
          if (normalizedFilters.entryIntoForce?.length) {
            if (!normalizedFilters.entryIntoForce.includes(document.entryIntoForce)) {
              return false;
            }
          }

          if (normalizedFilters.publicationDates?.length) {
            if (!normalizedFilters.publicationDates.includes(document.publicationDateBucket)) {
              return false;
            }
          }

          return true;
        })
        .sort((a, b) => b.baseScore - a.baseScore)
        .slice(0, limit);

      return {
        rewrittenQuery: `${query.trim()} — obligations contractuelles OHADA`,
        data: filtered.map((document, index) => ({
          id: document.id,
          score: Number((document.baseScore - index * 0.015).toFixed(3)),
          document: {
            id: document.id,
            title: document.title,
            href: document.href,
            snippet: document.snippet,
          },
          attributes: {
            entryIntoForce: document.entryIntoForce,
            publicationDate: document.publicationDate,
            publicationDateBucket: document.publicationDateBucket,
            type: document.type,
          },
        })),
      };
    },
  };
}

describe('research search route', () => {
  const supabaseStub = { from: vi.fn(), rpc: vi.fn() } as unknown as any;
  let fastifyApp: Awaited<ReturnType<typeof createApp>>['app'];

  beforeAll(async () => {
    setVectorStoreClientFactory(() => createVectorStoreMock());
    const created = await createApp({ supabase: supabaseStub });
    fastifyApp = created.app;
    await fastifyApp.ready();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    resetOpenAIClientFactories();
    await fastifyApp.close();
  });

  it('returns ranked research results with rewritten query echo', async () => {
    const response = await request(fastifyApp.server)
      .post('/api/research/search')
      .send({ query: 'inexécution contractuelle', limit: 3 })
      .expect(200);

    expect(response.body.query).toBe('inexécution contractuelle');
    expect(response.body.rewrittenQuery).toBe('inexécution contractuelle — obligations contractuelles OHADA');
    expect(response.body.results).toHaveLength(3);
    expect(response.body.results[0].id).toBe('doc-ausgie-1132');
    expect(response.body.results[0].score).toBeGreaterThan(response.body.results[1].score);
  });

  it('applies entry into force filters to restrict results', async () => {
    const response = await request(fastifyApp.server)
      .post('/api/research/search')
      .send({ query: 'résiliation clause', filters: { entryIntoForce: ['future'] } })
      .expect(200);

    expect(response.body.filters.applied.entryIntoForce).toEqual(['future']);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].attributes.entryIntoForce).toBe('future');
    expect(response.body.results[0].id).toBe('doc-jo-ohada-2025-01');
  });

  it('applies publication date filters to narrow matches', async () => {
    const response = await request(fastifyApp.server)
      .post('/api/research/search')
      .send({ query: 'mise en demeure', filters: { publicationDates: ['last-12-months'] } })
      .expect(200);

    expect(response.body.filters.applied.publicationDates).toEqual(['last-12-months']);
    expect(response.body.results).toHaveLength(1);
    expect(response.body.results[0].id).toBe('doc-ausgie-1132');
    expect(response.body.results[0].attributes.publicationDateBucket).toBe('last-12-months');
  });
});

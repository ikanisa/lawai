import Fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerWorkspaceRoutes } from '../src/domain/workspace/routes.ts';
import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from '../src/workspace.ts';
import type { AppContext } from '../src/types/context.ts';

const authorizeRequestWithGuardsMock = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock('../src/http/authorization.ts', () => ({
  authorizeRequestWithGuards: authorizeRequestWithGuardsMock,
}));

const supabaseMock = {
  from: vi.fn(),
};

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    __result: result,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

async function createAppWithRoutes() {
  const app = Fastify();
  const context: AppContext = {
    supabase: supabaseMock as unknown as AppContext['supabase'],
    config: { openai: { apiKey: 'test', baseUrl: undefined } },
    container: {} as AppContext['container'],
  };
  await registerWorkspaceRoutes(app, context);
  await app.ready();
  return app;
}

describe('workspace domain routes', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    authorizeRequestWithGuardsMock.mockClear();
  });

  it('returns the workspace overview payload', async () => {
    const jurisdictionsResult = {
      data: [
        { code: 'FR', name: 'France', eu: true, ohada: false },
        { code: 'OH', name: 'OHADA', eu: false, ohada: true },
      ],
      error: null,
    };
    const mattersResult = {
      data: [
        {
          id: 'run-1',
          question: 'Question 1',
          risk_level: 'medium',
          hitl_required: true,
          status: 'completed',
          started_at: '2024-01-01T00:00:00.000Z',
          finished_at: '2024-01-01T00:05:00.000Z',
          jurisdiction_json: { country: 'FR' },
        },
        {
          id: 'run-2',
          question: 'Question 2',
          risk_level: 'high',
          hitl_required: false,
          status: 'pending',
          started_at: '2024-01-02T00:00:00.000Z',
          finished_at: null,
          jurisdiction_json: { country_code: 'OH' },
        },
      ],
      error: null,
    };
    const sourcesResult = {
      data: [
        {
          id: 'src-1',
          title: 'Decree 123',
          publisher: 'Gazette',
          source_url: 'https://example.com/decree',
          jurisdiction_code: 'FR',
          consolidated: true,
          effective_date: '2024-01-03',
          created_at: '2024-01-04T00:00:00.000Z',
          source_type: 'statute',
          binding_lang: 'fr',
          language_note: null,
          capture_sha256: 'checksum-1',
        },
      ],
      error: null,
    };
    const hitlResult = {
      data: [
        { id: 'hitl-1', run_id: 'run-2', reason: 'review', status: 'pending', created_at: '2024-01-05T00:00:00.000Z' },
        { id: 'hitl-2', run_id: 'run-1', reason: 'check', status: 'approved', created_at: '2024-01-06T00:00:00.000Z' },
      ],
      error: null,
    };

    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'jurisdictions':
          return createQueryBuilder(jurisdictionsResult);
        case 'agent_runs':
          return createQueryBuilder(mattersResult);
        case 'sources':
          return createQueryBuilder(sourcesResult);
        case 'hitl_queue':
          return createQueryBuilder(hitlResult);
        default:
          throw new Error(`unexpected table ${table}`);
      }
    });

    const app = await createAppWithRoutes();
    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      jurisdictions: [
        { code: 'FR', name: 'France', eu: true, ohada: false, matterCount: 1 },
        { code: 'OH', name: 'OHADA', eu: false, ohada: true, matterCount: 1 },
      ],
      matters: [
        {
          id: 'run-1',
          question: 'Question 1',
          status: 'completed',
          riskLevel: 'medium',
          hitlRequired: true,
          startedAt: '2024-01-01T00:00:00.000Z',
          finishedAt: '2024-01-01T00:05:00.000Z',
          jurisdiction: 'FR',
        },
        {
          id: 'run-2',
          question: 'Question 2',
          status: 'pending',
          riskLevel: 'high',
          hitlRequired: false,
          startedAt: '2024-01-02T00:00:00.000Z',
          finishedAt: null,
          jurisdiction: 'OH',
        },
      ],
      complianceWatch: [
        {
          id: 'src-1',
          title: 'Decree 123',
          publisher: 'Gazette',
          url: 'https://example.com/decree',
          jurisdiction: 'FR',
          consolidated: true,
          effectiveDate: '2024-01-03',
          createdAt: '2024-01-04T00:00:00.000Z',
        },
      ],
      hitlInbox: {
        items: [
          { id: 'hitl-1', runId: 'run-2', reason: 'review', status: 'pending', createdAt: '2024-01-05T00:00:00.000Z' },
          { id: 'hitl-2', runId: 'run-1', reason: 'check', status: 'approved', createdAt: '2024-01-06T00:00:00.000Z' },
        ],
        pendingCount: 1,
      },
      desk: buildPhaseCWorkspaceDesk(),
      navigator: buildPhaseCProcessNavigator(),
    });

    await app.close();
  });

  it('returns citations with workspace fields', async () => {
    const sourcesResult = {
      data: [
        {
          id: 'src-1',
          title: 'Decree 123',
          source_type: 'statute',
          jurisdiction_code: 'FR',
          source_url: 'https://example.com/decree',
          publisher: 'Gazette',
          binding_lang: 'fr',
          consolidated: true,
          language_note: null,
          effective_date: '2024-01-03',
          created_at: '2024-01-04T00:00:00.000Z',
          capture_sha256: 'checksum-1',
        },
      ],
      error: null,
    };

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'sources') {
        return createQueryBuilder(sourcesResult);
      }
      throw new Error(`unexpected table ${table}`);
    });

    const app = await createAppWithRoutes();
    const response = await app.inject({
      method: 'GET',
      url: '/citations?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      entries: [
        {
          id: 'src-1',
          title: 'Decree 123',
          sourceType: 'statute',
          jurisdiction: 'FR',
          url: 'https://example.com/decree',
          publisher: 'Gazette',
          bindingLanguage: 'fr',
          consolidated: true,
          languageNote: null,
          effectiveDate: '2024-01-03',
          capturedAt: '2024-01-04T00:00:00.000Z',
          checksum: 'checksum-1',
        },
      ],
    });

    await app.close();
  });

  it('returns case scores including nested source metadata', async () => {
    const caseScoresResult = {
      data: [
        {
          id: 'score-1',
          source_id: 'src-1',
          juris_code: 'FR',
          score_overall: 0.75,
          axes: { reliability: 0.9 },
          hard_block: false,
          version: 'v1',
          model_ref: 'gpt',
          notes: 'ok',
          computed_at: '2024-01-07T00:00:00.000Z',
          sources: {
            title: 'Decree 123',
            source_url: 'https://example.com/decree',
            trust_tier: 'gold',
            court_rank: 'supreme',
          },
        },
      ],
      error: null,
    };

    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'case_scores') {
        return createQueryBuilder(caseScoresResult);
      }
      throw new Error(`unexpected table ${table}`);
    });

    const app = await createAppWithRoutes();
    const response = await app.inject({
      method: 'GET',
      url: '/case-scores?orgId=org-1&sourceId=src-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      scores: [
        {
          id: 'score-1',
          sourceId: 'src-1',
          jurisdiction: 'FR',
          score: 0.75,
          axes: { reliability: 0.9 },
          hardBlock: false,
          version: 'v1',
          modelRef: 'gpt',
          notes: 'ok',
          computedAt: '2024-01-07T00:00:00.000Z',
          source: {
            title: 'Decree 123',
            url: 'https://example.com/decree',
            trustTier: 'gold',
            courtRank: 'supreme',
          },
        },
      ],
    });

    await app.close();
  });
});

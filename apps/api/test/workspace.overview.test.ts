import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/http/authorization.js', () => ({
  authorizeRequestWithGuards: vi.fn(async () => ({})),
}));

import { registerWorkspaceRoutes } from '../src/domain/workspace/routes.js';
import type { AppContext } from '../src/types/context.js';
import type { SupabaseClient } from '@supabase/supabase-js';

const ORG_ID = '00000000-0000-0000-0000-000000000123';
const USER_ID = 'user-test';

type QueryResult = { data: unknown; error: unknown };

type QueryFactory = () => QueryResult | Promise<QueryResult>;

function createQueryBuilder(factory: QueryFactory) {
  let executed: Promise<QueryResult> | null = null;
  const execute = () => {
    if (!executed) {
      executed = Promise.resolve().then(factory);
    }
    return executed;
  };

  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
      execute().then(onFulfilled, onRejected),
    catch: (onRejected: (reason: unknown) => unknown) => execute().catch(onRejected),
    finally: (onFinally: () => void) => execute().finally(onFinally),
  };

  return builder;
}

describe('workspace overview route', () => {
  let app: FastifyInstance;
  const queryFactories = new Map<string, QueryFactory>();
  const supabaseMock = {
    from: vi.fn((table: string) => {
      const factory = queryFactories.get(table);
      if (!factory) {
        throw new Error(`Unexpected table ${table}`);
      }
      return createQueryBuilder(factory);
    }),
  };
  const supabase = supabaseMock as unknown as SupabaseClient;

  const createContext = (): AppContext => ({
    supabase,
    config: { openai: { apiKey: 'test-key' } },
    rateLimits: {},
  });

  beforeEach(async () => {
    queryFactories.clear();
    supabaseMock.from.mockClear();
    app = Fastify();
    await registerWorkspaceRoutes(app, createContext());
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns a complete overview when all queries succeed', async () => {
    queryFactories.set('jurisdictions', () => ({
      data: [
        { code: 'FR', name: 'France', eu: true, ohada: false },
        { code: 'OH', name: 'OHADA', eu: false, ohada: true },
      ],
      error: null,
    }));
    queryFactories.set('agent_runs', () => ({
      data: [
        {
          id: 'run-1',
          question: 'Synthèse assignation Paris',
          risk_level: 'medium',
          hitl_required: true,
          status: 'completed',
          started_at: '2024-01-01T09:00:00.000Z',
          finished_at: '2024-01-01T09:30:00.000Z',
          jurisdiction_json: { country: 'FR' },
        },
      ],
      error: null,
    }));
    queryFactories.set('sources', () => ({
      data: [
        {
          id: 'src-1',
          title: 'CEPEJ 2024 updates',
          publisher: 'CEPEJ',
          source_url: 'https://example.org/cepej',
          jurisdiction_code: 'FR',
          consolidated: true,
          effective_date: '2024-01-01',
          created_at: '2024-01-03T10:00:00.000Z',
        },
      ],
      error: null,
    }));
    queryFactories.set('hitl_queue', () => ({
      data: [
        {
          id: 'hitl-1',
          run_id: 'run-1',
          reason: 'confidential_evidence',
          status: 'pending',
          created_at: '2024-01-02T12:00:00.000Z',
        },
      ],
      error: null,
    }));

    const response = await app.inject({
      method: 'GET',
      url: `/workspace?orgId=${ORG_ID}`,
      headers: { 'x-user-id': USER_ID },
    });

    const payload = response.json();
    expect(response.statusCode).toBe(200);
    expect(payload.meta).toEqual({ status: 'ok', warnings: [], errors: {} });
    expect(payload.jurisdictions).toHaveLength(2);
    expect(payload.matters[0]).toMatchObject({
      id: 'run-1',
      question: 'Synthèse assignation Paris',
      jurisdiction: 'FR',
    });
    expect(payload.complianceWatch).toHaveLength(1);
    expect(payload.hitlInbox.pendingCount).toBe(1);
  });

  it('returns partial data when a query reports an error', async () => {
    queryFactories.set('jurisdictions', () => ({ data: [], error: null }));
    queryFactories.set('agent_runs', () => ({ data: [], error: new Error('matters failed') }));
    queryFactories.set('sources', () => ({ data: [], error: null }));
    queryFactories.set('hitl_queue', () => ({ data: [], error: null }));

    const response = await app.inject({
      method: 'GET',
      url: `/workspace?orgId=${ORG_ID}`,
      headers: { 'x-user-id': USER_ID },
    });

    const payload = response.json();
    expect(response.statusCode).toBe(206);
    expect(payload.meta.status).toBe('partial');
    expect(payload.meta.errors.matters).toBeDefined();
    expect(payload.meta.warnings).toContain('Partial data: failed to load matters.');
  });

  it('returns 500 when fetching the overview throws', async () => {
    queryFactories.set('jurisdictions', () => {
      throw new Error('jurisdictions unavailable');
    });
    queryFactories.set('agent_runs', () => ({ data: [], error: null }));
    queryFactories.set('sources', () => ({ data: [], error: null }));
    queryFactories.set('hitl_queue', () => ({ data: [], error: null }));

    const response = await app.inject({
      method: 'GET',
      url: `/workspace?orgId=${ORG_ID}`,
      headers: { 'x-user-id': USER_ID },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: 'workspace_fetch_failed' });
  });
});

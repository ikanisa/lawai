import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const storageFromMock = vi.fn();

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: storageFromMock },
};

type QueryResult<T = unknown> = { data: T; error: unknown };

function createQueryBuilder<T>(result: QueryResult<T>) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    update: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: QueryResult<T>) => unknown) => Promise.resolve(resolve(result)),
  };
  return builder;
}

const authorizeRequestWithGuardsMock = vi.fn(async (_action: string, orgId: string, userId: string) => ({
  orgId,
  userId,
  policies: {},
  consent: {
    requirement: { version: '2024.01' },
    latest: { version: '2024.01' },
  },
  councilOfEurope: {
    requirement: { version: '2024.06' },
    acknowledgedVersion: '2024.06',
  },
}));

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/http/authorization.ts', () => ({
  authorizeRequestWithGuards: authorizeRequestWithGuardsMock,
}));

const { app } = await import('../src/server.ts');

describe('Workspace domain routes', () => {
  let jurisdictionsResult: QueryResult;
  let agentRunsResult: QueryResult;
  let sourcesResult: QueryResult;
  let hitlResult: QueryResult;
  let acknowledgementsResult: QueryResult;
  let complianceAssessmentsResult: QueryResult;

  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    storageFromMock.mockReset();
    authorizeRequestWithGuardsMock.mockClear();

    jurisdictionsResult = {
      data: [
        { code: 'FR', name: 'France', eu: true, ohada: false },
        { code: 'OH', name: 'OHADA', eu: false, ohada: true },
      ],
      error: null,
    };
    agentRunsResult = {
      data: [
        {
          id: 'run-1',
          question: 'How do I file?',
          status: 'completed',
          risk_level: 'low',
          hitl_required: false,
          started_at: '2024-06-01T00:00:00Z',
          finished_at: '2024-06-01T01:00:00Z',
          jurisdiction_json: { country: 'FR' },
        },
      ],
      error: null,
    };
    sourcesResult = {
      data: [
        {
          id: 'source-1',
          title: 'AI Act',
          publisher: 'EU',
          source_url: 'https://example.test',
          jurisdiction_code: 'EU',
          consolidated: true,
          effective_date: '2024-06-01',
          created_at: '2024-06-02',
        },
      ],
      error: null,
    };
    hitlResult = {
      data: [
        { id: 'hitl-1', run_id: 'run-1', reason: 'review', status: 'pending', created_at: '2024-06-03' },
        { id: 'hitl-2', run_id: 'run-2', reason: 'resolved', status: 'resolved', created_at: '2024-06-02' },
      ],
      error: null,
    };
    acknowledgementsResult = {
      data: [
        { consent_type: 'ai_assist', version: '2024.06', created_at: '2024-06-10', org_id: 'org-123' },
        { consent_type: 'council_of_europe_disclosure', version: '2024.06', created_at: '2024-06-10', org_id: 'org-123' },
      ],
      error: null,
    };
    complianceAssessmentsResult = {
      data: [
        {
          run_id: 'run-1',
          created_at: '2024-06-09',
          fria_required: true,
          fria_reasons: ['high_risk'],
          cepej_passed: false,
          cepej_violations: ['transparency'],
          statute_passed: true,
          statute_violations: [],
          disclosures_missing: ['consent'],
        },
      ],
      error: null,
    };

    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'jurisdictions':
          return createQueryBuilder(jurisdictionsResult);
        case 'agent_runs':
          return createQueryBuilder(agentRunsResult);
        case 'sources':
          return createQueryBuilder(sourcesResult);
        case 'hitl_queue':
          return createQueryBuilder(hitlResult);
        case 'consent_events':
          return createQueryBuilder(acknowledgementsResult);
        case 'compliance_assessments':
          return createQueryBuilder(complianceAssessmentsResult);
        default:
          return createQueryBuilder({ data: [], error: null });
      }
    });

    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
  });

  it('returns workspace overview data', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=00000000-0000-0000-0000-000000000000',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.jurisdictions).toHaveLength(2);
    expect(body.matters[0].jurisdiction).toBe('FR');
    expect(body.hitlInbox.pendingCount).toBe(1);
  });

  it('fetches compliance acknowledgements summary', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.acknowledgements.consent.acknowledgedVersion).toBe('2024.06');
    expect(body.acknowledgements.councilOfEurope.satisfied).toBe(true);
  });

  it('records compliance acknowledgements and refreshes summary', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });

    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-123' },
      payload: { consent: { type: 'ai_assist', version: '2024.06' } },
    });

    expect(response.statusCode).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('record_consent_events', expect.any(Object));
  });

  it('returns compliance assessment history merged with acknowledgements', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/compliance/status?limit=3',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.history).toHaveLength(1);
    expect(body.latest.assessment.disclosures.consentSatisfied).toBe(true);
    expect(body.totals.total).toBe(1);
  });

  it('applies rate limits to workspace overview', async () => {
    let status429 = 0;
    for (let i = 0; i < 35; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/workspace?orgId=00000000-0000-0000-0000-000000000000',
        headers: { 'x-user-id': 'user-1' },
      });
      if (res.statusCode === 429) {
        status429 += 1;
        break;
      }
    }
    expect(status429).toBe(1);
  });
});

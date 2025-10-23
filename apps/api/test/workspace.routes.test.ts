import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

process.env.NODE_ENV = 'test';

const storageFromMock = vi.fn();

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: { from: storageFromMock },
};

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    __result: result,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    insert: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    upsert: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

const authorizeActionMock = vi.fn(async (_action: string, orgId: string, userId: string) => ({
  orgId,
  userId,
  role: 'admin',
  policies: {
    confidentialMode: false,
    franceJudgeAnalyticsBlocked: false,
    mfaRequired: false,
    ipAllowlistEnforced: false,
    consentRequirement: { type: 'ai_assist', version: '1.0' },
    councilOfEuropeRequirement: { version: '2024-01' },
    sensitiveTopicHitl: false,
    residencyZone: null,
    residencyZones: null,
  },
  rawPolicies: {},
  entitlements: new Map(),
  ipAllowlistCidrs: [],
  consent: { requirement: { type: 'ai_assist', version: '1.0' }, latest: null },
  councilOfEurope: { requirement: { version: '2024-01' }, acknowledgedVersion: null },
}));

vi.mock('../src/access-control.ts', () => ({
  authorizeAction: authorizeActionMock,
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

vi.mock('../src/device-sessions.ts', () => ({
  recordDeviceSession: vi.fn(async () => undefined),
}));

const { createApp } = await import('../src/app.js');

describe('workspace domain routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const created = await createApp();
    app = created.app;
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
    storageFromMock.mockReset();
    authorizeActionMock.mockClear();
  });

  it('returns workspace overview data', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'jurisdictions') {
        return createQueryBuilder({
          data: [{ code: 'FR', name: 'France', eu: true, ohada: false }],
          error: null,
        });
      }
      if (table === 'agent_runs') {
        return createQueryBuilder({
          data: [
            {
              id: 'run-1',
              question: 'Quelle est la procédure ?',
              risk_level: 'low',
              hitl_required: false,
              status: 'completed',
              started_at: '2024-05-01T00:00:00Z',
              finished_at: '2024-05-01T00:05:00Z',
              jurisdiction_json: { country: 'FR' },
            },
          ],
          error: null,
        });
      }
      if (table === 'sources') {
        return createQueryBuilder({
          data: [
            {
              id: 'src-1',
              title: 'Code civil',
              publisher: 'Légifrance',
              source_url: 'https://legifrance.gouv.fr',
              jurisdiction_code: 'FR',
              consolidated: true,
              effective_date: '2024-01-01',
              created_at: '2024-05-01T00:00:00Z',
            },
          ],
          error: null,
        });
      }
      if (table === 'hitl_queue') {
        return createQueryBuilder({
          data: [
            {
              id: 'hitl-1',
              run_id: 'run-1',
              reason: 'review',
              status: 'pending',
              created_at: '2024-05-01T00:10:00Z',
            },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
      remoteAddress: '10.0.0.1',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.jurisdictions[0].matterCount).toBe(1);
    expect(body.hitlInbox.pendingCount).toBe(1);
    expect(body.matters[0].jurisdiction).toBe('FR');
  });

  it('persists compliance acknowledgements and refreshes summary', async () => {
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'consent_events') {
        return createQueryBuilder({
          data: [
            { consent_type: 'ai_assist', version: '1.0', created_at: '2024-05-01T00:00:00Z' },
            { consent_type: 'council_of_europe_disclosure', version: '2024-01', created_at: '2024-05-02T00:00:00Z' },
          ],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
      payload: {
        consent: { type: 'ai_assist', version: '1.0' },
        councilOfEurope: { version: '2024-01' },
      },
      remoteAddress: '10.0.0.2',
    });

    expect(response.statusCode).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('record_consent_events', {
      events: [
        { org_id: 'org-1', user_id: 'user-1', consent_type: 'ai_assist', version: '1.0' },
        {
          org_id: 'org-1',
          user_id: 'user-1',
          consent_type: 'council_of_europe_disclosure',
          version: '2024-01',
        },
      ],
    });

    const body = response.json();
    expect(body.acknowledgements.consent.acknowledgedVersion).toBe('1.0');
    expect(body.acknowledgements.councilOfEurope.acknowledgedVersion).toBe('2024-01');
  });

  it('returns compliance status merged with acknowledgements', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'compliance_assessments') {
        return createQueryBuilder({
          data: [
            {
              run_id: 'run-1',
              created_at: '2024-05-01T00:00:00Z',
              fria_required: true,
              fria_reasons: ['litigation'],
              cepej_passed: false,
              cepej_violations: ['transparency'],
              statute_passed: true,
              statute_violations: [],
              disclosures_missing: ['consent'],
            },
          ],
          error: null,
        });
      }
      if (table === 'consent_events') {
        return createQueryBuilder({
          data: [{ consent_type: 'ai_assist', version: '1.0', created_at: '2024-05-01T00:00:00Z' }],
          error: null,
        });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/compliance/status?limit=3',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
      remoteAddress: '10.0.0.3',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.history).toHaveLength(1);
    expect(body.latest.assessment.disclosures.consentSatisfied).toBe(true);
    expect(body.totals.friaRequired).toBe(1);
  });

  it('rate limits acknowledgement fetches', async () => {
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'consent_events') {
        return createQueryBuilder({ data: [], error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    let gotRateLimited = false;
    for (let i = 0; i < 20; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/compliance/acknowledgements',
        headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
        remoteAddress: '10.0.0.4',
      });
      if (res.statusCode === 429) {
        gotRateLimited = true;
        break;
      }
    }

    expect(gotRateLimited).toBe(true);
  });
});

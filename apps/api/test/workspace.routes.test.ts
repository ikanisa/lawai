import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
};

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    __result: result,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    or: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/access-control.ts', () => ({
  authorizeAction: vi.fn(async (_action: string, orgId: string, userId: string) => ({
    orgId,
    userId,
    role: 'admin',
    policies: {
      confidentialMode: false,
      franceJudgeAnalyticsBlocked: false,
      mfaRequired: false,
      ipAllowlistEnforced: false,
      consentRequirement: { type: 'ai_assist', version: '2024.01' },
      councilOfEuropeRequirement: { version: '2024.02', documentUrl: null },
      sensitiveTopicHitl: false,
      residencyZone: null,
      residencyZones: null,
    },
    rawPolicies: {},
    entitlements: new Map(),
    ipAllowlistCidrs: [],
    consent: {
      requirement: { type: 'ai_assist', version: '2024.01' },
      latest: { type: 'ai_assist', version: '2024.01' },
    },
    councilOfEurope: {
      requirement: { version: '2024.02', documentUrl: null },
      acknowledgedVersion: '2024.02',
    },
  })),
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

vi.mock('../src/device-sessions.ts', () => ({
  recordDeviceSession: vi.fn(async () => undefined),
}));

const { createApp } = await import('../src/app.ts');
const { app } = await createApp();

afterAll(async () => {
  await app.close();
});

describe('Workspace routes', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('returns workspace overview snapshot', async () => {
    const now = new Date().toISOString();
    supabaseMock.from.mockImplementation((table: string) => {
      switch (table) {
        case 'jurisdictions':
          return createQueryBuilder({ data: [{ code: 'FR', name: 'France', eu: true, ohada: false }], error: null });
        case 'agent_runs':
          return createQueryBuilder({
            data: [
              {
                id: 'run-1',
                question: 'How to comply?',
                risk_level: 'low',
                hitl_required: false,
                status: 'completed',
                started_at: now,
                finished_at: now,
                jurisdiction_json: { country: 'FR' },
              },
            ],
            error: null,
          });
        case 'sources':
          return createQueryBuilder({
            data: [
              {
                id: 'source-1',
                title: 'Policy update',
                publisher: 'EU',
                source_url: 'https://example.com',
                jurisdiction_code: 'FR',
                consolidated: true,
                effective_date: now,
                created_at: now,
              },
            ],
            error: null,
          });
        case 'hitl_queue':
          return createQueryBuilder({
            data: [
              {
                id: 'hitl-1',
                run_id: 'run-1',
                reason: 'policy_review',
                status: 'pending',
                created_at: now,
              },
            ],
            error: null,
          });
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/workspace?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.jurisdictions).toHaveLength(1);
    expect(body.jurisdictions[0]).toMatchObject({ code: 'FR', matterCount: 1 });
    expect(body.hitlInbox.pendingCount).toBe(1);
    expect(body).toHaveProperty('desk');
    expect(body).toHaveProperty('navigator');
  });

  it('returns compliance acknowledgements summary', async () => {
    const now = new Date().toISOString();
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'consent_events') {
        return createQueryBuilder({
          data: [
            { consent_type: 'ai_assist', version: '2024.01', created_at: now },
            { consent_type: 'council_of_europe_disclosure', version: '2024.02', created_at: now },
          ],
          error: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.acknowledgements.consent).toMatchObject({ satisfied: true, requiredVersion: '2024.01' });
    expect(body.acknowledgements.councilOfEurope).toMatchObject({ satisfied: true, requiredVersion: '2024.02' });
  });

  it('records compliance acknowledgements and returns updated state', async () => {
    const now = new Date().toISOString();
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'consent_events') {
        return createQueryBuilder({
          data: [
            { consent_type: 'ai_assist', version: '2024.01', created_at: now },
          ],
          error: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });
    supabaseMock.rpc.mockResolvedValue({ error: null });

    const response = await app.inject({
      method: 'POST',
      url: '/compliance/acknowledgements',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
      payload: { consent: { type: 'ai_assist', version: '2024.01' } },
    });

    expect(response.statusCode).toBe(200);
    expect(supabaseMock.rpc).toHaveBeenCalledWith('record_consent_events', {
      events: [
        {
          org_id: 'org-1',
          user_id: 'user-1',
          consent_type: 'ai_assist',
          version: '2024.01',
        },
      ],
    });
    const body = response.json();
    expect(body.acknowledgements.consent.satisfied).toBe(true);
  });

  it('returns compliance status history with totals', async () => {
    const now = new Date().toISOString();
    supabaseMock.from.mockImplementation((table: string) => {
      if (table === 'consent_events') {
        return createQueryBuilder({
          data: [
            { consent_type: 'ai_assist', version: '2024.01', created_at: now },
            { consent_type: 'council_of_europe_disclosure', version: '2024.02', created_at: now },
          ],
          error: null,
        });
      }
      if (table === 'compliance_assessments') {
        return createQueryBuilder({
          data: [
            {
              run_id: 'run-1',
              created_at: now,
              fria_required: true,
              fria_reasons: ['policy_gap'],
              cepej_passed: false,
              cepej_violations: ['article_6'],
              statute_passed: true,
              statute_violations: [],
              disclosures_missing: ['consent'],
            },
          ],
          error: null,
        });
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const response = await app.inject({
      method: 'GET',
      url: '/compliance/status?limit=3',
      headers: { 'x-user-id': 'user-1', 'x-org-id': 'org-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.history).toHaveLength(1);
    expect(body.latest.assessment.fria.reasons).toContain('policy_gap');
    expect(body.latest.assessment.disclosures.consentSatisfied).toBe(true);
    expect(body.totals).toMatchObject({ total: 1, friaRequired: 1, cepejViolations: 1, disclosureGaps: 1 });
  });
});

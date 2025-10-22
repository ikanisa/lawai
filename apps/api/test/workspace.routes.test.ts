import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

process.env.NODE_ENV = 'test';

const tableResults: Record<string, { data: unknown; error: unknown }> = {};

const createQueryBuilder = (table: string) => {
  const query: any = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
      Promise.resolve(tableResults[table] ?? { data: [], error: null }).then(resolve),
  };
  return query;
};

const supabaseMock = {
  from: vi.fn((table: string) => createQueryBuilder(table)),
};

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/device-sessions.ts', () => ({
  recordDeviceSession: vi.fn(async () => undefined),
}));

const authorizeRequestWithGuards = vi.fn(async (_action: string, orgId: string, userId: string) => ({
  orgId,
  userId,
  role: 'admin' as const,
  policies: {
    confidentialMode: false,
    franceJudgeAnalyticsBlocked: false,
    mfaRequired: false,
    ipAllowlistEnforced: false,
    consentRequirement: null,
    councilOfEuropeRequirement: null,
    sensitiveTopicHitl: false,
    residencyZone: null,
    residencyZones: null,
  },
  rawPolicies: {},
  entitlements: new Map(),
  ipAllowlistCidrs: [],
  consent: { requirement: null },
  councilOfEurope: { requirement: null },
}));

vi.mock('../src/http/authorization.js', () => ({
  authorizeRequestWithGuards,
}));

const ORG_ID = '00000000-0000-0000-0000-000000000123';
const USER_ID = '00000000-0000-0000-0000-000000000999';

let app: FastifyInstance;

beforeAll(async () => {
  const { createApp } = await import('../src/app.js');
  const created = await createApp();
  app = created.app;
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(() => {
  tableResults.jurisdictions = {
    data: [
      { code: 'FR', name: 'France', eu: true, ohada: false },
      { code: 'BF', name: 'Burkina Faso', eu: false, ohada: true },
    ],
    error: null,
  };
  tableResults.agent_runs = {
    data: [
      {
        id: 'run-1',
        question: 'Quels délais pour une assignation civile à Paris ?',
        risk_level: 'medium',
        hitl_required: false,
        status: 'succeeded',
        started_at: '2024-06-01T10:00:00Z',
        finished_at: '2024-06-01T10:05:00Z',
        jurisdiction_json: { country: 'FR' },
      },
      {
        id: 'run-2',
        question: 'Comment notifier une saisie OHADA ?',
        risk_level: 'high',
        hitl_required: true,
        status: 'pending',
        started_at: '2024-06-02T09:00:00Z',
        finished_at: null,
        jurisdiction_json: { country_code: 'BF' },
      },
    ],
    error: null,
  };
  tableResults.sources = {
    data: [
      {
        id: 'source-1',
        title: 'Décret Maghreb 2024-05',
        publisher: 'JO Maghreb',
        source_url: 'https://example.com/decret',
        jurisdiction_code: 'MA',
        consolidated: true,
        effective_date: '2024-05-20',
        created_at: '2024-05-21T12:00:00Z',
      },
    ],
    error: null,
  };
  tableResults.hitl_queue = {
    data: [
      {
        id: 'hitl-1',
        run_id: 'run-2',
        reason: 'policy_review',
        status: 'pending',
        created_at: '2024-06-02T09:30:00Z',
      },
      {
        id: 'hitl-2',
        run_id: 'run-3',
        reason: 'ohada_override',
        status: 'approved',
        created_at: '2024-06-01T11:00:00Z',
      },
    ],
    error: null,
  };

  authorizeRequestWithGuards.mockReset();
  authorizeRequestWithGuards.mockImplementation(async (_action: string, orgId: string, userId: string) => ({
    orgId,
    userId,
    role: 'admin' as const,
    policies: {
      confidentialMode: false,
      franceJudgeAnalyticsBlocked: false,
      mfaRequired: false,
      ipAllowlistEnforced: false,
      consentRequirement: null,
      councilOfEuropeRequirement: null,
      sensitiveTopicHitl: false,
      residencyZone: null,
      residencyZones: null,
    },
    rawPolicies: {},
    entitlements: new Map(),
    ipAllowlistCidrs: [],
    consent: { requirement: null },
    councilOfEurope: { requirement: null },
  }));

  supabaseMock.from.mockClear();
});

describe('workspace routes', () => {
  it('returns the workspace overview payload for authorised requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/workspace?orgId=${ORG_ID}`,
      headers: { 'x-user-id': USER_ID },
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.body) as {
      jurisdictions: Array<{ code: string; matterCount: number }>;
      matters: Array<{ id: string; jurisdiction: string | null }>;
      complianceWatch: Array<{ id: string }>;
      hitlInbox: { items: Array<{ id: string }>; pendingCount: number };
      navigator: Array<{ id: string }>;
    };

    expect(payload.jurisdictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FR', matterCount: 1 }),
        expect.objectContaining({ code: 'BF', matterCount: 1 }),
      ]),
    );
    expect(payload.matters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'run-1', jurisdiction: 'FR' }),
        expect.objectContaining({ id: 'run-2', jurisdiction: 'BF' }),
      ]),
    );
    expect(payload.complianceWatch).toHaveLength(1);
    expect(payload.hitlInbox.pendingCount).toBe(1);
    expect(payload.hitlInbox.items.some((item) => item.id === 'hitl-1')).toBe(true);
    expect(Array.isArray(payload.navigator)).toBe(true);
    expect(payload.navigator.length).toBeGreaterThan(0);
  });

  it('validates query parameters', async () => {
    const response = await app.inject({ method: 'GET', url: '/workspace?orgId=invalid-uuid' });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid query parameters' });
  });

  it('requires an x-user-id header', async () => {
    const response = await app.inject({ method: 'GET', url: `/workspace?orgId=${ORG_ID}` });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'x-user-id header is required' });
  });

  it('propagates authorisation failures with status codes', async () => {
    const authError = new Error('forbidden');
    (authError as any).statusCode = 403;
    authorizeRequestWithGuards.mockRejectedValueOnce(authError);

    const response = await app.inject({
      method: 'GET',
      url: `/workspace?orgId=${ORG_ID}`,
      headers: { 'x-user-id': USER_ID },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: 'forbidden' });
  });
});

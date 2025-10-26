import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseMock = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

const createAccessContext = (orgId: string, userId: string) => ({
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
  entitlements: new Map<string, { canRead: boolean; canWrite: boolean }>(),
  ipAllowlistCidrs: [],
  consent: { requirement: null, latest: null },
  councilOfEurope: { requirement: null, acknowledgedVersion: null },
});

const authorizeRequestWithGuards = vi.fn(async (_action: string, orgId: string, userId: string) =>
  createAccessContext(orgId, userId),
);

vi.mock('../src/http/authorization.js', () => ({
  authorizeRequestWithGuards,
}));

vi.mock('../src/access-control.ts', () => ({
  authorizeAction: vi.fn(async (_action: string, orgId: string, userId: string) => createAccessContext(orgId, userId)),
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

// avoid device session writes noise
vi.mock('../src/device-sessions.ts', () => ({ recordDeviceSession: vi.fn(async () => undefined) }));

const { app } = await import('../src/server.ts');

function createQueryBuilder(listResult: { data: unknown; error: unknown }, singleResult?: { data: unknown; error: unknown }) {
  const builder: any = {
    __list: listResult,
    __single: singleResult ?? listResult,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(listResult),
    maybeSingle: vi.fn(() => Promise.resolve(singleResult ?? listResult)),
    single: vi.fn(() => Promise.resolve(singleResult ?? listResult)),
  };
  return builder;
}

describe('Metrics governance route', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('rejects missing orgId with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics/governance' });
    expect(res.statusCode).toBe(400);
  });

  it('requires x-user-id header', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics/governance?orgId=org-1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with minimal data', async () => {
    const list = { data: [], error: null };
    const single = { data: null, error: null };
    supabaseMock.from.mockReturnValue(createQueryBuilder(list, single));
    const res = await app.inject({ method: 'GET', url: '/metrics/governance?orgId=org-1', headers: { 'x-user-id': 'user-1' } });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveProperty('overview');
    expect(json).toHaveProperty('tools');
  });
});

describe('Metrics SLO route', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('rejects missing orgId with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics/slo' });
    expect(res.statusCode).toBe(400);
  });

  it('requires x-user-id header', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics/slo?orgId=org-1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with minimal data', async () => {
    const list = { data: [], error: null };
    supabaseMock.from.mockReturnValue(createQueryBuilder(list));
    const res = await app.inject({ method: 'GET', url: '/metrics/slo?orgId=org-1', headers: { 'x-user-id': 'user-1' } });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveProperty('snapshots');
  });
});

describe('Metrics evaluations route', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('rejects missing orgId with 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics/evaluations' });
    expect(res.statusCode).toBe(400);
  });

  it('requires x-user-id header', async () => {
    const res = await app.inject({ method: 'GET', url: '/metrics/evaluations?orgId=org-1' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 200 with minimal data', async () => {
    const list = { data: [], error: null };
    supabaseMock.from.mockReturnValue(createQueryBuilder(list));
    const res = await app.inject({ method: 'GET', url: '/metrics/evaluations?orgId=org-1', headers: { 'x-user-id': 'user-1' } });
    expect(res.statusCode).toBe(200);
    const json = res.json();
    expect(json).toHaveProperty('summary');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseMock = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/device-sessions.ts', () => ({
  recordDeviceSession: vi.fn(async () => undefined),
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
  })),
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

const { app } = await import('../src/server.ts');
const { __resetLaunchStateForTests } = await import('../src/launch.js');

const ORG_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';

describe('launch regulator digest routes', () => {
  beforeEach(() => {
    __resetLaunchStateForTests();
  });

  it('rejects missing headers', async () => {
    const res = await app.inject({ method: 'POST', url: '/launch/digests', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('enqueues digests and lists them for the org', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/launch/digests',
      headers: { 'x-org-id': ORG_ID, 'x-user-id': USER_ID },
      payload: {
        jurisdiction: 'FR',
        channel: 'email',
        frequency: 'weekly',
        recipients: ['ops@example.com'],
        topics: ['cepej'],
      },
    });

    expect(create.statusCode).toBe(201);
    const created = create.json() as { digest: { id: string; orgId: string; requestedBy: string } };
    expect(created.digest.orgId).toBe(ORG_ID);
    expect(created.digest.requestedBy).toBe(USER_ID);

    const list = await app.inject({
      method: 'GET',
      url: `/launch/digests?orgId=${ORG_ID}&limit=5`,
      headers: { 'x-org-id': ORG_ID, 'x-user-id': USER_ID },
    });

    expect(list.statusCode).toBe(200);
    const digests = list.json() as { digests: Array<{ id: string; channel: string }>; orgId: string };
    expect(digests.orgId).toBe(ORG_ID);
    expect(digests.digests).toHaveLength(1);
    expect(digests.digests[0]?.channel).toBe('email');
  });

  it('validates request bodies', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/launch/digests',
      headers: { 'x-org-id': ORG_ID, 'x-user-id': USER_ID },
      payload: {
        channel: 'email',
        frequency: 'weekly',
        recipients: [],
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

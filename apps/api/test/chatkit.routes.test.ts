import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseMock = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/chatkit.ts', () => ({
  createChatSession: vi.fn(async () => ({ id: 's1', orgId: 'org-1', userId: 'user-1' })),
  listSessionsForOrg: vi.fn(async () => []),
  getChatSession: vi.fn(async () => ({ id: 's1', orgId: 'org-1' })),
  cancelChatSession: vi.fn(async () => ({ id: 's1', status: 'cancelled' })),
  recordChatEvent: vi.fn(async () => undefined),
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

describe('Chatkit routes', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('requires x-user-id header on create session', async () => {
    const response = await app.inject({ method: 'POST', url: '/chatkit/sessions', payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it('creates session with valid payload', async () => {
    const payload = { orgId: 'org-1', agentName: 'research', channel: 'web' };
    const response = await app.inject({ method: 'POST', url: '/chatkit/sessions', payload, headers: { 'x-user-id': 'user-1' } });
    expect(response.statusCode).toBe(201);
  });
});


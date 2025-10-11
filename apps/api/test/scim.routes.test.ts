import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseMock = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/access-control.ts', () => ({
  authorizeAction: vi.fn(async (_action: string, orgId: string, userId: string) => ({
    orgId,
    userId,
    role: 'admin',
    policies: { confidentialMode: false },
  })),
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

vi.mock('../src/sso.ts', () => ({
  resolveScimToken: vi.fn(async (_token: string) => ({ tokenId: 'tok-1', orgId: 'org-1' })),
}));

vi.mock('../src/audit.ts', () => ({ logAuditEvent: vi.fn(async () => undefined) }));

// avoid device session writes noise
vi.mock('../src/device-sessions.ts', () => ({ recordDeviceSession: vi.fn(async () => undefined) }));

const { app } = await import('../src/server.ts');

function supabaseBuilder(result: { data: unknown; error: unknown }) {
  const b: any = {
    select: vi.fn(() => b),
    eq: vi.fn(() => b),
    order: vi.fn(() => b),
    limit: vi.fn(() => b),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    insert: vi.fn(() => Promise.resolve(result)),
    upsert: vi.fn(() => Promise.resolve(result)),
    update: vi.fn(() => Promise.resolve(result)),
    delete: vi.fn(() => Promise.resolve(result)),
  };
  return b;
}

describe('SCIM routes', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('requires Authorization header for SCIM create', async () => {
    const res = await app.inject({ method: 'POST', url: '/scim/v2/Users', payload: {} });
    expect(res.statusCode).toBe(401);
  });

  it('creates user with valid SCIM token', async () => {
    supabaseMock.from.mockReturnValue(supabaseBuilder({ data: null, error: null }));
    const payload = { id: 'user-1', emails: [{ value: 'user@example.com', primary: true }], role: 'admin' };
    const res = await app.inject({
      method: 'POST',
      url: '/scim/v2/Users',
      payload,
      headers: { Authorization: 'Bearer abc123' },
    });
    expect(res.statusCode).toBe(201);
  });
});


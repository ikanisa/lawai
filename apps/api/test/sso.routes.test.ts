import { describe, expect, it, vi } from 'vitest';

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

vi.mock('../src/audit.ts', () => ({ logAuditEvent: vi.fn(async () => undefined) }));

const { app } = await import('../src/server.ts');

describe('SSO admin routes', () => {
  it('requires x-user-id on list', async () => {
    const res = await app.inject({ method: 'GET', url: '/admin/org/org-1/sso' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects missing provider on upsert', async () => {
    const res = await app.inject({ method: 'POST', url: '/admin/org/org-1/sso', headers: { 'x-user-id': 'user-1' }, payload: {} });
    expect(res.statusCode).toBe(400);
  });
});


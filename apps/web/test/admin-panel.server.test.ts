import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  savePolicy,
  saveEntitlement,
  recordHitlDecision,
  getPolicies,
  getJurisdictions,
} from '../src/server/admin/handlers';

vi.mock('../src/server/supabase/admin-client', async () => {
  const store = {
    policies: new Map<string, any[]>(),
    entitlements: new Map<string, any[]>(),
    audits: [] as any[],
  };
  return {
    listPolicies: vi.fn(async (orgId: string) => store.policies.get(orgId) ?? []),
    upsertPolicy: vi.fn(async (orgId: string, key: string, value: unknown) => {
      const list = store.policies.get(orgId) ?? [];
      const record = { key, value, updated_at: 'now', updated_by: 'tester', org_id: orgId };
      store.policies.set(orgId, [record, ...list.filter((item) => item.key !== key)]);
      return record;
    }),
    listEntitlements: vi.fn(async (orgId: string) => store.entitlements.get(orgId) ?? []),
    upsertEntitlement: vi.fn(async (orgId: string, jurisdiction: string, entitlement: string, enabled: boolean) => {
      const list = store.entitlements.get(orgId) ?? [];
      const record = {
        org_id: orgId,
        jurisdiction,
        entitlement,
        enabled,
        updated_at: 'now',
      };
      store.entitlements.set(orgId, [record, ...list.filter((item) => item.entitlement !== entitlement)]);
      return record;
    }),
    appendAuditEvent: vi.fn(async (event: any) => {
      store.audits.push(event);
      return event;
    }),
    listAuditEvents: vi.fn(async () => store.audits),
    listJobs: vi.fn(async () => []),
    enqueueJob: vi.fn(async () => undefined),
    updateHitlItem: vi.fn(async (_orgId: string, itemId: string, status: string) => ({ id: itemId, status })),
  };
});

const adminClient = await import('../src/server/supabase/admin-client');
vi.mock('../src/server/supabase/session', () => ({
  getSupabaseSession: vi.fn(),
}));

const { getSupabaseSession } = await import('../src/server/supabase/session');
const { requireAdminContext, AdminAccessError } = await import('../src/server/admin/auth');

describe('admin panel service layer', () => {
  const orgId = 'org-demo';
  const actor = 'tester@demo.org';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts policy and emits audit event', async () => {
    await savePolicy(orgId, 'feature:test', true, actor);
    const policies = await getPolicies(orgId);
    expect(policies.policies).toHaveLength(1);
    expect(policies.policies[0]).toMatchObject({ key: 'feature:test', value: true });
    expect(adminClient.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'policy.upsert', actor })
    );
  });

  it('upserts entitlement and records audit event', async () => {
    await saveEntitlement(orgId, 'fr', 'corpus', true, actor);
    const entitlements = await getJurisdictions(orgId);
    expect(entitlements.entitlements).toHaveLength(1);
    expect(entitlements.entitlements[0]).toMatchObject({ jurisdiction: 'fr', entitlement: 'corpus', enabled: true });
    expect(adminClient.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'entitlement.toggle', object: 'fr:corpus' })
    );
  });

  it('records HITL decisions for audit trail', async () => {
    await recordHitlDecision(orgId, 'hitl-123', 'approve', actor);
    expect(adminClient.appendAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'hitl.approve', object: 'hitl-123' })
    );
  });
});

describe('requireAdminContext', () => {
  const baseUser = {
    id: 'user-1',
    email: 'admin@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    created_at: new Date().toISOString(),
    last_sign_in_at: new Date().toISOString(),
    identities: [],
    factors: [],
    user_metadata: {},
    app_metadata: {},
    phone: '',
    phone_confirmed_at: null,
    email_confirmed_at: null,
    confirmed_at: null,
    is_anonymous: false,
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws 401 when session is missing', async () => {
    (getSupabaseSession as vi.Mock).mockResolvedValueOnce(null);

    await requireAdminContext(new Request('http://localhost/api/admin/overview')).catch((error) => {
      expect(error).toBeInstanceOf(AdminAccessError);
      expect(error).toMatchObject({ status: 401 });
    });
  });

  it('rejects non-admin sessions with 403', async () => {
    (getSupabaseSession as vi.Mock).mockResolvedValueOnce({
      user: { ...baseUser, app_metadata: { org_id: 'org-1' } },
      accessToken: 'token',
      roles: ['member'],
      organizations: ['org-1'],
      actorId: 'admin@example.com',
    });

    await expect(
      requireAdminContext(new Request('http://localhost/api/admin/overview')),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects requests for unauthorized organizations', async () => {
    (getSupabaseSession as vi.Mock).mockResolvedValueOnce({
      user: { ...baseUser, app_metadata: { org_id: 'org-1', roles: ['admin'] } },
      accessToken: 'token',
      roles: ['admin'],
      organizations: ['org-1'],
      actorId: 'admin@example.com',
    });

    const request = new Request('http://localhost/api/admin/overview?orgId=org-2', {
      headers: { 'x-admin-org': 'org-2' },
    });

    await expect(requireAdminContext(request)).rejects.toMatchObject({ status: 403 });
  });

  it('returns derived actor/org identifiers for authorized sessions', async () => {
    (getSupabaseSession as vi.Mock).mockResolvedValueOnce({
      user: {
        ...baseUser,
        app_metadata: { org_id: 'org-1', roles: ['admin'] },
        user_metadata: { actor_id: 'admin@example.com' },
      },
      accessToken: 'token',
      roles: ['admin'],
      organizations: ['org-1', 'org-2'],
      actorId: 'admin@example.com',
    });

    const request = new Request('http://localhost/api/admin/overview', {
      headers: { 'x-admin-org': 'org-2' },
    });

    const context = await requireAdminContext(request);
    expect(context.orgId).toBe('org-2');
    expect(context.actorId).toBe('admin@example.com');
    expect(context.roles).toContain('admin');
    expect(context.organizations).toEqual(expect.arrayContaining(['org-1', 'org-2']));
  });
});

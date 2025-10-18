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

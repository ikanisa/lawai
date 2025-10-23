import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuditLogger } from '../src/audit.js';

function createSupabaseMock() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return {
    client: { from } as unknown as SupabaseClient,
    insert,
    select,
    maybeSingle,
  };
}

describe('AuditLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts sensitive fields and preserves metadata allow list', async () => {
    const supabase = createSupabaseMock();
    const logger = new AuditLogger(supabase.client, {
      metadataAllowList: ['policy_version', 'job_id'],
      redactionPaths: ['before.password', 'after.secret'],
    });

    await logger.log({
      orgId: 'org-1',
      actorId: 'user-1',
      kind: 'test',
      object: 'resource',
      before: { password: 'hunter2', nested: { value: 'ok' } },
      after: { secret: 'api-key-123', list: ['one', { two: 2 }] },
      metadata: { policy_version: 'v2', job_id: 42, raw: { nested: true } },
    });

    expect(supabase.insert).toHaveBeenCalledTimes(1);
    const payload = supabase.insert.mock.calls[0][0];
    expect(payload.before_state.password).toBe('***');
    expect(payload.before_state.nested.value).toBe('ok');
    expect(payload.after_state.secret).toBe('***');
    expect(payload.after_state.list[1].two).toBe(2);
    expect(payload.metadata).toEqual({ policy_version: 'v2', job_id: 42 });
  });

  it('applies default residency when none provided', async () => {
    const supabase = createSupabaseMock();
    const logger = new AuditLogger(supabase.client, { defaultResidency: 'eu' });

    await logger.log({
      orgId: 'org-1',
      kind: 'test',
      object: 'resource',
    });

    const payload = supabase.insert.mock.calls[0][0];
    expect(payload.residency_zone).toBe('eu');
  });

  it('throws when Supabase insert fails', async () => {
    const failingInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) }),
    });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert: failingInsert }),
    } as unknown as SupabaseClient;

    const logger = new AuditLogger(supabase);

    await expect(
      logger.log({ orgId: 'org-1', kind: 'test', object: 'resource' }),
    ).rejects.toThrowError(/audit_event_failed:boom/);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listCommandsForSession,
  listOrgConnectors,
  registerConnector,
  updateSessionState,
} from '../src/orchestrator.js';

function createQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: any = {
    __result: result,
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: { data: unknown; error: unknown }) => unknown) => resolve(result),
  };
  return builder;
}

describe('orchestrator helpers', () => {
  it('registers connectors via RPC', async () => {
    const rpcMock = vi.fn(async () => ({ data: 'connector-1', error: null }));
    const supabase = { rpc: rpcMock } as unknown as SupabaseClient;

    const result = await registerConnector(supabase, {
      orgId: 'org-1',
      connectorType: 'erp',
      name: 'netsuite',
      config: { account: 'suite' },
      metadata: { region: 'eu' },
      createdBy: 'user-1',
    });

    expect(result).toBe('connector-1');
    expect(rpcMock).toHaveBeenCalledWith('register_org_connector', expect.objectContaining({
      p_org_id: 'org-1',
      p_connector_type: 'erp',
      p_name: 'netsuite',
      p_created_by: 'user-1',
    }));
  });

  it('updates session state with provided patches', async () => {
    const eqMock = vi.fn(async () => ({ error: null }));
    const updateMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ update: updateMock }));
    const supabase = { from: fromMock } as unknown as SupabaseClient;

    await updateSessionState(supabase, {
      sessionId: 'session-1',
      directorState: { objective: 'close books' },
      currentObjective: 'close books',
    });

    expect(fromMock).toHaveBeenCalledWith('orchestrator_sessions');
    expect(updateMock).toHaveBeenCalledWith({
      director_state: { objective: 'close books' },
      current_objective: 'close books',
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'session-1');
  });

  it('lists commands for a session', async () => {
    const now = new Date().toISOString();
    const commandRow = {
      id: 'cmd-1',
      org_id: 'org-1',
      session_id: 'session-1',
      command_type: 'sync_connector',
      payload: {},
      status: 'queued',
      priority: 100,
      scheduled_for: now,
      started_at: null,
      completed_at: null,
      failed_at: null,
      result: null,
      last_error: null,
      metadata: {},
      created_at: now,
      updated_at: now,
    };
    const builder = createQueryBuilder({ data: [commandRow], error: null });
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);

    const supabase = { from: vi.fn(() => builder) } as unknown as SupabaseClient;

    const commands = await listCommandsForSession(supabase, 'session-1', 10);

    expect(commands).toHaveLength(1);
    expect(commands[0].id).toBe('cmd-1');
    expect(commands[0].sessionId).toBe('session-1');
  });

  it('lists organisation connectors', async () => {
    const connectorRow = {
      id: 'conn-1',
      org_id: 'org-1',
      connector_type: 'erp',
      name: 'payables_module',
      status: 'active',
      config: {},
      metadata: {},
      last_synced_at: null,
      last_error: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const builder = createQueryBuilder({ data: [connectorRow], error: null });
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);

    const supabase = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
    const connectors = await listOrgConnectors(supabase, 'org-1');

    expect(supabase.from).toHaveBeenCalledWith('org_connectors');
    expect(connectors).toHaveLength(1);
    expect(connectors[0].name).toBe('payables_module');
    expect(connectors[0].status).toBe('active');
  });
});

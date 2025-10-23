import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinanceDirectorPlan } from '@avocat-ai/shared';
import { FinanceDirectorPlanSchema } from '@avocat-ai/shared';
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

const sampleDirectorPlan: FinanceDirectorPlan = FinanceDirectorPlanSchema.parse({
  version: '2025.02',
  objective: 'Clôturer les comptes',
  summary: 'Plan de clôture standard',
  decisionLog: ['Analyse initiale'],
  steps: [
    {
      id: 'step-1',
      status: 'pending',
      envelope: {
        worker: 'domain',
        commandType: 'finance.accounts_payable.reconcile',
        title: 'Rapprocher le grand livre',
        description: 'Vérifier les soldes AP vs GL',
        domain: 'accounts_payable',
        payload: {},
        successCriteria: ['Soldes équilibrés'],
        dependencies: [],
        connectorDependencies: ['erp:general_ledger'],
        telemetry: ['ap_reconciliation_latency'],
        guardrails: { safetyPolicies: ['policy.ap_confidentiality'], residency: ['eu'] },
        hitl: { required: false, reasons: [], mitigations: [] },
      },
      notes: [],
    },
  ],
  globalHitl: { required: false, reasons: [], mitigations: [] },
});

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
      directorState: sampleDirectorPlan,
      currentObjective: 'close books',
    });

    expect(fromMock).toHaveBeenCalledWith('orchestrator_sessions');
    expect(updateMock).toHaveBeenCalledWith({
      director_state: sampleDirectorPlan,
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

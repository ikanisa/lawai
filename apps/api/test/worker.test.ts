import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  workerRegistry,
  claimFinanceJobs,
  runFinanceWorker,
  processFinanceQueue,
  resetWorkerRegistry,
} from '../src/worker.js';
import { registerFinanceWorkers } from '../src/finance-workers.js';
import type { FinanceWorkerEnvelope } from '@avocat-ai/shared';
import { financeCommandPayloadSchema, listPendingJobs, updateCommandStatus, updateJobStatus } from '@avocat-ai/shared';

vi.mock('@avocat-ai/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@avocat-ai/shared')>();
  return {
    ...actual,
    listPendingJobs: vi.fn(actual.listPendingJobs),
    updateJobStatus: vi.fn(actual.updateJobStatus),
    updateCommandStatus: vi.fn(actual.updateCommandStatus),
  };
});

const listPendingJobsMock = listPendingJobs as unknown as vi.Mock;
const updateJobStatusMock = updateJobStatus as unknown as vi.Mock;
const updateCommandStatusMock = updateCommandStatus as unknown as vi.Mock;

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? (input as Request).method : 'GET')).toUpperCase();

  if ((url.includes('tax.example/filings') || url.includes('tax_authority_gateway.example/filings')) && method === 'POST') {
    return jsonResponse({ submissionId: 'SUB-1', status: 'submitted', submittedAt: new Date().toISOString() });
  }
  if ((url.includes('tax.example/audit-responses') || url.includes('tax_authority_gateway.example/audit-responses')) && method === 'POST') {
    return jsonResponse({ status: 'acknowledged' });
  }
  if ((url.includes('tax.example/filings') || url.includes('tax_authority_gateway.example/filings')) && method === 'GET') {
    return jsonResponse({ jurisdiction: 'FR', period: '2025-Q1', dueDate: '2025-05-01', status: 'prepared' });
  }
  if ((url.includes('erp.example/ap/invoices') || url.includes('payables_module.example/ap/invoices')) && method === 'POST') {
    return jsonResponse({ invoiceId: 'INV-1', status: 'approved' });
  }
  if ((url.includes('erp.example/ap/payments/schedule') || url.includes('payables_module.example/ap/payments/schedule')) && method === 'POST') {
    return jsonResponse({ scheduleId: 'SCH-1', status: 'scheduled' });
  }
  if ((url.includes('grc.example/audit/walkthroughs') || url.includes('grc_platform.example/audit/walkthroughs')) && method === 'POST') {
    return jsonResponse({ id: 'WT-1', status: 'ready' });
  }
  if ((url.includes('grc.example/audit/pbc') || url.includes('grc_platform.example/audit/pbc')) && method === 'POST') {
    return jsonResponse({ id: 'PBC-1', status: 'recorded' });
  }
  if ((url.includes('grc.example/risk/register') || url.includes('grc_platform.example/risk/register')) && method === 'POST') {
    return jsonResponse({ id: 'RISK-1', status: 'recorded' });
  }
  if ((url.includes('grc.example/controls/tests') || url.includes('grc_platform.example/controls/tests')) && method === 'POST') {
    return jsonResponse({ id: 'CTRLTEST-1', status: 'logged' });
  }
  if ((url.includes('analytics.example/board-packs') || url.includes('bi_warehouse.example/board-packs')) && method === 'POST') {
    return jsonResponse({ packId: 'BP-1', status: 'ready', metrics: { revenue: 1000 } });
  }
  if ((url.includes('analytics.example/scenarios') || url.includes('bi_warehouse.example/scenarios')) && method === 'POST') {
    return jsonResponse({ scenarioId: 'SC-1', status: 'completed', outputs: { revenue: 1200 } });
  }
  if ((url.includes('analytics.example/kpi') || url.includes('bi_warehouse.example/kpi')) && method === 'GET') {
    return jsonResponse({ revenue: 1000 });
  }
  if ((url.includes('reg.example/filings') || url.includes('regulatory_portal.example/filings')) && method === 'POST') {
    return jsonResponse({ submissionId: 'REG-1', status: 'submitted' });
  }
  if ((url.includes('reg.example/documents/upload') || url.includes('regulatory_portal.example/documents/upload')) && method === 'POST') {
    return jsonResponse({ documentId: 'DOC-1' });
  }
  if ((url.includes('reg.example/filings') || url.includes('regulatory_portal.example/filings')) && method === 'GET') {
    return jsonResponse({ jurisdiction: 'FR', filingType: 'TVA', status: 'in_progress', dueDate: '2025-05-01' });
  }

  return jsonResponse({ status: 'ok' });
});

beforeAll(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  fetchMock.mockClear();
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function connectorsRows(overrides: Record<string, { connector_type: string; status?: string; config?: Record<string, unknown> }>): Array<Record<string, unknown>> {
  return Object.entries(overrides).map(([name, details]) => ({
    name,
    connector_type: details.connector_type,
    status: details.status ?? 'active',
    config: details.config ?? { endpoint: `https://${name}.example` },
    metadata: {},
  }));
}

function createSupabaseMock(
  handlers: Record<string, () => Record<string, unknown>> = {},
  connectorMap?: Record<string, { connector_type: string; status?: string; config?: Record<string, unknown> }>,
): SupabaseClient {
  const resolvedHandlers: Record<string, () => Record<string, unknown>> = { ...handlers };

  const makeFilterBuilder = () => {
    const builder: Record<string, any> = {};
    builder.eq = vi.fn(() => builder);
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => ({
      limit: vi.fn(async () => ({ data: [], error: null })),
    }));
    builder.limit = vi.fn(async () => ({ data: [], error: null }));
    builder.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    return builder;
  };

  const makeUpdateBuilder = () => ({
    eq: vi.fn(async () => ({ data: null, error: null })),
  });

  resolvedHandlers.orchestrator_commands ??= () => ({
    select: vi.fn(() => makeFilterBuilder()),
    update: vi.fn(() => makeUpdateBuilder()),
  });
  resolvedHandlers.orchestrator_jobs ??= () => ({
    select: vi.fn(() => makeFilterBuilder()),
    update: vi.fn(() => makeUpdateBuilder()),
  });
  if (connectorMap) {
    const rows = connectorsRows(connectorMap);
    resolvedHandlers.org_connectors = () => ({
      select: () => ({
        eq: vi.fn(() => Promise.resolve({ data: rows, error: null })),
      }),
    });
  }
  const supabase = {
    from: vi.fn((table: string) => {
      const handler = resolvedHandlers[table];
      if (!handler) {
        throw new Error(`Unexpected table ${table}`);
      }
      return handler();
    }),
  } as unknown as SupabaseClient;
  return supabase;
}

const defaultConnectorConfigs: Record<FinanceDomainKey, Record<string, { connector_type: string }>> = {
  tax_compliance: {
    tax_authority_gateway: { connector_type: 'tax' },
    general_ledger: { connector_type: 'erp' },
  },
  accounts_payable: {
    payables_module: { connector_type: 'erp' },
  },
  audit_assurance: {
    grc_platform: { connector_type: 'compliance' },
  },
  risk_controls: {
    grc_platform: { connector_type: 'compliance' },
  },
  cfo_strategy: {
    bi_warehouse: { connector_type: 'analytics' },
  },
  regulatory_filings: {
    regulatory_portal: { connector_type: 'tax' },
  },
};

function buildEnvelope(options: {
  domain?: FinanceDomainKey;
  intent?: FinanceCommandIntent;
  connectors?: Record<string, { status: string }>;
  inputs?: Record<string, unknown>;
  objective?: string;
} = {}): FinanceWorkerEnvelope {
  const domain = options.domain ?? 'tax_compliance';
  const defaultIntent: Record<FinanceDomainKey, FinanceCommandIntent> = {
    tax_compliance: 'tax.prepare_filing',
    accounts_payable: 'ap.process_invoice',
    audit_assurance: 'audit.prepare_walkthrough',
    risk_controls: 'risk.update_register',
    cfo_strategy: 'cfo.generate_board_pack',
    regulatory_filings: 'regulatory.prepare_filing',
  };
  const intent = options.intent ?? defaultIntent[domain];
  const connectors = options.connectors ?? Object.fromEntries(
    Object.entries(defaultConnectorConfigs[domain]).map(([name]) => [name, { status: 'active' }]),
  );

  const payload = financeCommandPayloadSchema.parse({
    intent,
    domain,
    objective: options.objective ?? 'Objectif finance',
    inputs: options.inputs ?? {},
    guardrails: [],
    telemetry: [],
    connectors,
  });

  return {
    command: {
      id: `cmd-${domain}`,
      orgId: 'org-1',
      sessionId: 'session-1',
      commandType: 'finance.domain',
      payload,
      status: 'queued',
      priority: 100,
      scheduledFor: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      result: null,
      lastError: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    session: {
      id: 'session-1',
      orgId: 'org-1',
      chatSessionId: null,
      status: 'active',
      directorState: null,
      safetyState: null,
      metadata: {},
      currentObjective: null,
      lastDirectorRunId: null,
      lastSafetyRunId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      closedAt: null,
    },
    job: {
      id: `job-${domain}`,
      orgId: 'org-1',
      commandId: `cmd-${domain}`,
      worker: 'domain',
      domainAgent: domain,
      status: 'pending',
      attempts: 0,
      scheduledAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      failedAt: null,
      lastError: null,
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

describe('worker', () => {
  beforeEach(() => {
    listPendingJobsMock.mockReset();
    updateJobStatusMock.mockReset();
    updateCommandStatusMock.mockReset();
    resetWorkerRegistry();
    registerFinanceWorkers();
  });

  it('claims finance jobs and filters invalid payloads', async () => {
    const valid = buildEnvelope();
    const invalid = { ...valid, command: { ...valid.command, payload: {} } } as FinanceWorkerEnvelope;
    listPendingJobsMock.mockResolvedValue([valid, invalid]);

    const result = await claimFinanceJobs(createSupabaseMock(), { orgId: 'org-1', worker: 'domain' });

    expect(result).toHaveLength(1);
    expect(result[0].command.payload.intent).toBe('tax.prepare_filing');
  });

  it('executes worker and persists tax filing state with connector call', async () => {
    const envelope = buildEnvelope();

    const taxUpsert = vi.fn(() => ({
      select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'filing-1' }, error: null }) }),
    }));

    const supabase = createSupabaseMock(
      {
        finance_tax_filings: () => ({
          upsert: taxUpsert,
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: () => Promise.resolve({ data: { due_date: '2025-04-30', status: 'prepared' }, error: null }) }),
            }),
          }),
        }),
      },
      defaultConnectorConfigs.tax_compliance,
    );

    updateJobStatusMock.mockResolvedValue(undefined);
    updateCommandStatusMock.mockResolvedValue(undefined);

    const result = await runFinanceWorker(supabase, envelope);

    expect(result.status).toBe('completed');
    expect(result.output?.summary).toContain('Préparation du dépôt fiscal');
    expect(result.output?.submissionId).toBe('SUB-1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://tax_authority_gateway.example/filings'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(taxUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ submissionId: 'SUB-1' }) }),
      expect.anything(),
    );
  });

  it('processes queue with registered worker', async () => {
    const envelope = buildEnvelope();
    listPendingJobsMock.mockResolvedValue([envelope]);

    const taxUpsert = vi.fn(() => ({
      select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'filing-1' }, error: null }) }),
    }));

    const supabase = createSupabaseMock(
      {
        finance_tax_filings: () => ({
          upsert: taxUpsert,
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: () => Promise.resolve({ data: { due_date: '2025-04-30', status: 'prepared' }, error: null }) }),
            }),
          }),
        }),
      },
      defaultConnectorConfigs.tax_compliance,
    );

    updateJobStatusMock.mockResolvedValue(undefined);
    updateCommandStatusMock.mockResolvedValue(undefined);

    const processed = await processFinanceQueue(supabase, { orgId: 'org-1', worker: 'domain' });

    expect(processed).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
    expect(updateJobStatusMock).toHaveBeenCalled();
    expect(updateCommandStatusMock).toHaveBeenCalled();
  });

  it('escalates to HITL when required connector inactive', async () => {
    const envelope = buildEnvelope({ connectors: { tax_authority_gateway: { status: 'pending' } } });

    const supabase = createSupabaseMock({}, defaultConnectorConfigs.tax_compliance);

    updateJobStatusMock.mockResolvedValue(undefined);
    updateCommandStatusMock.mockResolvedValue(undefined);

    const result = await runFinanceWorker(supabase, envelope);

    expect(result.hitlReason).toContain('activate_connectors');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('processes accounts payable invoice via ERP connector', async () => {
    const envelope = buildEnvelope({
      domain: 'accounts_payable',
      intent: 'ap.process_invoice',
      inputs: { amount: 1200, currency: 'EUR', vendor: 'Acme' },
    });

    const insertMock = vi.fn(() => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'ap-1' }, error: null }) }) }));

    const supabase = createSupabaseMock(
      {
        finance_ap_invoices: () => ({ insert: insertMock, select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      },
      defaultConnectorConfigs.accounts_payable,
    );

    updateJobStatusMock.mockResolvedValue(undefined);
    updateCommandStatusMock.mockResolvedValue(undefined);

    const result = await runFinanceWorker(supabase, envelope);

    expect(result.status).toBe('completed');
    expect(result.output?.erpEndpoint).toContain('payables_module');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://payables_module.example/ap/invoices'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(insertMock).toHaveBeenCalled();
  });

  it('logs risk control test via GRC connector', async () => {
    const envelope = buildEnvelope({
      domain: 'risk_controls',
      intent: 'risk.assess_control',
      inputs: { controlId: 'CTRL-9', testResult: 'passed' },
    });

    const insertMock = vi.fn(() => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'ctrl-1' }, error: null }) }) }));

    const supabase = createSupabaseMock(
      {
        finance_risk_control_tests: () => ({ insert: insertMock }),
        risk_register: () => ({ insert: () => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'risk-1' }, error: null }) }) }) }),
      },
      defaultConnectorConfigs.risk_controls,
    );

    updateJobStatusMock.mockResolvedValue(undefined);
    updateCommandStatusMock.mockResolvedValue(undefined);

    const result = await runFinanceWorker(supabase, envelope);

    expect(result.status).toBe('completed');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://grc_platform.example/controls/tests'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(insertMock).toHaveBeenCalled();
  });

  it('generates board pack via analytics connector', async () => {
    const envelope = buildEnvelope({
      domain: 'cfo_strategy',
      intent: 'cfo.generate_board_pack',
      inputs: { period: '2025-Q1', metrics: { revenue: 1000 } },
    });

    const upsertMock = vi.fn(() => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'bp-1' }, error: null }) }) }));

    const supabase = createSupabaseMock(
      {
        finance_board_packs: () => ({ upsert: upsertMock }),
      },
      defaultConnectorConfigs.cfo_strategy,
    );

    updateJobStatusMock.mockResolvedValue(undefined);
    updateCommandStatusMock.mockResolvedValue(undefined);

    const result = await runFinanceWorker(supabase, envelope);

    expect(result.status).toBe('completed');
    expect(result.output?.analyticsEndpoint).toContain('bi_warehouse');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://bi_warehouse.example/board-packs'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(upsertMock).toHaveBeenCalled();
  });

  it('submits regulatory filing via portal connector', async () => {
    const envelope = buildEnvelope({
      domain: 'regulatory_filings',
      intent: 'regulatory.prepare_filing',
      inputs: { jurisdiction: 'FR', filing: 'TVA', dueDate: '2025-05-01' },
    });

    const upsertMock = vi.fn(() => ({ select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'reg-1' }, error: null }) }) }));

    const supabase = createSupabaseMock(
      {
        finance_regulatory_filings: () => ({ upsert: upsertMock }),
      },
      defaultConnectorConfigs.regulatory_filings,
    );

    updateJobStatusMock.mockResolvedValue(undefined);
    updateCommandStatusMock.mockResolvedValue(undefined);

    const result = await runFinanceWorker(supabase, envelope);

    expect(result.status).toBe('completed');
    expect(result.output?.regulatoryEndpoint).toContain('regulatory_portal');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://regulatory_portal.example/filings'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(upsertMock).toHaveBeenCalled();
  });
});

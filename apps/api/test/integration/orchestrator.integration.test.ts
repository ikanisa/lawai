import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Agents from '@openai/agents';
import type {
  FinanceDirectorPlan,
  FinanceSafetyReview,
  OrchestratorCommandEnvelope,
  OrchestratorCommandRecord,
  OrchestratorJobRecord,
  OrchestratorSessionRecord,
  OrgConnectorRecord,
  OrchestratorCommandResponse,
} from '@avocat-ai/shared';
import { FinanceDirectorPlanSchema, FinanceSafetyReviewSchema } from '@avocat-ai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp } from '../../src/app.js';
import { registerOrchestratorRoutes } from '../../src/http/routes/orchestrator.js';
import type { OrchestratorAIGateway, OrchestratorRepository } from '../../src/core/repositories/orchestrator-repository.js';
import {
  runDirectorPlanning,
  runSafetyAssessment,
  type DirectorCommandInput,
  type RegisterConnectorInput,
} from '../../src/orchestrator.js';

vi.mock('@openai/agents', async () => {
  const actual = await vi.importActual<typeof import('@openai/agents')>('@openai/agents');
  return {
    ...actual,
    run: vi.fn(),
  };
});

vi.mock('../../src/audit.js', () => ({
  logAuditEvent: vi.fn(async () => undefined),
}));

vi.mock('../../src/openai.ts', () => ({
  getOpenAI: vi.fn(() => ({})),
  logOpenAIDebug: vi.fn(async () => undefined),
}));

const validPlan: FinanceDirectorPlan = FinanceDirectorPlanSchema.parse({
  version: '2025.02',
  objective: 'Close Q1 books',
  summary: 'Coordinate ledger reconciliation and disclosures.',
  decisionLog: ['Objective validated'],
  steps: [
    {
      id: 'plan-step-1',
      status: 'pending',
      envelope: {
        worker: 'domain',
        commandType: 'finance.accounts_payable.reconcile',
        title: 'Reconcile AP ledger',
        description: 'Match invoices to GL balances before closing.',
        domain: 'accounts_payable',
        payload: {},
        successCriteria: ['Ledger balanced within tolerance'],
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

describe('Finance agent schema enforcement', () => {
  const supabase = {} as SupabaseClient;

  function buildSession(): OrchestratorSessionRecord {
    const now = new Date().toISOString();
    return {
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
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    };
  }

  function buildEnvelope(session: OrchestratorSessionRecord): OrchestratorCommandEnvelope {
    const now = new Date().toISOString();
    return {
      command: {
        id: 'cmd-1',
        orgId: session.orgId,
        sessionId: session.id,
        commandType: 'finance.accounts_payable.reconcile',
        payload: {},
        status: 'queued',
        priority: 100,
        scheduledFor: now,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        result: null,
        lastError: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
      job: {
        id: 'job-1',
        orgId: session.orgId,
        commandId: 'cmd-1',
        worker: 'safety',
        domainAgent: null,
        status: 'pending',
        attempts: 0,
        scheduledAt: now,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        lastError: null,
        metadata: {},
        createdAt: now,
        updatedAt: now,
      },
      session,
    };
  }

  it('returns the typed director plan when the agent complies with the schema', async () => {
    const runMock = vi.mocked(Agents.run);
    runMock.mockResolvedValueOnce({ finalOutput: validPlan } as any);
    const session = buildSession();

    const result = await runDirectorPlanning(supabase, session, 'Close Q1 books', {});

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(validPlan);
  });

  it('maps safety refusals to rejected outcomes with reasons', async () => {
    const runMock = vi.mocked(Agents.run);
    runMock.mockResolvedValueOnce({ finalOutput: refusalReview } as any);
    const session = buildSession();
    const envelope = buildEnvelope(session);

    const result = await runSafetyAssessment(supabase, envelope);

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('rejected');
    expect(result.reasons).toContain('Policy finance.data_residency');
    expect(result.reasons).toContain('Connector residency violation');
    expect(result.mitigations).toEqual(['Route via EU mirror']);
  });

  it('escalates to HITL when the decision requires human review', async () => {
    const runMock = vi.mocked(Agents.run);
    runMock.mockResolvedValueOnce({ finalOutput: hitlReview } as any);
    const session = buildSession();
    const envelope = buildEnvelope(session);

    const result = await runSafetyAssessment(supabase, envelope);

    expect(runMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('needs_hitl');
    expect(result.reasons).toContain('Manual confirmation required');
    expect(result.mitigations).toEqual(['Collect supporting evidence']);
  });
});

const refusalReview: FinanceSafetyReview = FinanceSafetyReviewSchema.parse({
  command: {
    id: 'cmd-refuse-1',
    worker: 'director',
    commandType: 'finance.accounts_payable.reconcile',
    payloadFingerprint: 'fingerprint-1',
    hitl: { required: true, reasons: ['Sensitive data export'], mitigations: ['Mask PII before retry'] },
  },
  envelope: { sessionId: 'session-1', orgId: 'org-1', jobId: 'job-1' },
  decision: { status: 'rejected', reasons: ['Connector residency violation'], mitigations: ['Route via EU mirror'], hitlRequired: true },
  refusal: { reason: 'Policy finance.data_residency', policy: 'finance.data_residency' },
});

const hitlReview: FinanceSafetyReview = FinanceSafetyReviewSchema.parse({
  command: {
    id: 'cmd-hitl-1',
    worker: 'director',
    commandType: 'finance.audit.escalate',
    payloadFingerprint: 'fingerprint-2',
    hitl: { required: true, reasons: ['Critical audit exception'], mitigations: [] },
  },
  envelope: { sessionId: 'session-1', orgId: 'org-1', jobId: 'job-1' },
  decision: { status: 'needs_hitl', reasons: ['Manual confirmation required'], mitigations: ['Collect supporting evidence'], hitlRequired: true },
});

afterEach(() => {
  vi.resetAllMocks();
});

process.env.NODE_ENV = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role';
process.env.SUPABASE_SERVICE_URL = process.env.SUPABASE_SERVICE_URL ?? 'http://localhost:54321';

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

vi.mock('../../src/http/authorization.js', () => ({
  authorizeRequestWithGuards,
}));

vi.mock('../../src/access-control.ts', () => ({
  authorizeAction: vi.fn(async (_action: string, orgId: string, userId: string) => createAccessContext(orgId, userId)),
  ensureOrgAccessCompliance: vi.fn((ctx: unknown) => ctx),
}));

vi.mock('../../src/device-sessions.ts', () => ({
  recordDeviceSession: vi.fn(async () => undefined),
}));

class StubRepository implements OrchestratorRepository {
  commands: OrchestratorCommandRecord[] = [];
  envelopes = new Map<string, OrchestratorCommandEnvelope>();
  jobs = new Map<string, OrchestratorJobRecord>();
  metadata = new Map<string, { commandType: string; payload: Record<string, unknown> }>();
  connectors: OrgConnectorRecord[] = [];
  pending: OrchestratorCommandEnvelope[] = [];

  async listCommandsForSession(sessionId: string, limit = 50): Promise<OrchestratorCommandRecord[]> {
    return this.commands.filter((command) => command.sessionId === sessionId).slice(0, limit);
  }

  async enqueueDirectorCommand(input: DirectorCommandInput): Promise<OrchestratorCommandResponse> {
    const commandId = `cmd-${this.commands.length + 1}`;
    const sessionId = input.sessionId ?? `session-${this.commands.length + 1}`;
    const now = new Date().toISOString();
    const command: OrchestratorCommandRecord = {
      id: commandId,
      orgId: input.orgId,
      sessionId,
      commandType: input.commandType,
      payload: input.payload ?? {},
      status: 'queued',
      priority: input.priority ?? 100,
      scheduledFor: input.scheduledFor ?? null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      result: null,
      lastError: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    const jobId = `job-${this.jobs.size + 1}`;
    const job: OrchestratorJobRecord = {
      id: jobId,
      orgId: input.orgId,
      commandId,
      worker: input.worker ?? 'director',
      domainAgent: null,
      status: 'pending',
      attempts: 0,
      scheduledAt: now,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      lastError: null,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };
    const session: OrchestratorSessionRecord = {
      id: sessionId,
      orgId: input.orgId,
      chatSessionId: null,
      status: 'active',
      directorState: null,
      safetyState: null,
      metadata: {},
      currentObjective: null,
      lastDirectorRunId: null,
      lastSafetyRunId: null,
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    };
    const envelope: OrchestratorCommandEnvelope = {
      command,
      job,
      session,
    };
    this.commands.push(command);
    this.jobs.set(jobId, job);
    this.envelopes.set(commandId, envelope);
    this.metadata.set(commandId, { commandType: input.commandType, payload: input.payload ?? {} });
    this.pending.push(envelope);
    return {
      commandId,
      jobId,
      sessionId,
      status: command.status,
      scheduledFor: command.scheduledFor,
    };
  }

  getCommandEnvelope(commandId: string): Promise<OrchestratorCommandEnvelope> {
    const envelope = this.envelopes.get(commandId);
    if (!envelope) {
      throw new Error('command_not_found');
    }
    return Promise.resolve(envelope);
  }

  listPendingJobs(orgId: string, worker: OrchestratorJobRecord['worker'], limit: number): Promise<OrchestratorCommandEnvelope[]> {
    const items = this.pending.filter((envelope) => envelope.job.orgId === orgId && envelope.job.worker === worker);
    return Promise.resolve(items.slice(0, limit));
  }

  async updateJobStatus(jobId: string, status: OrchestratorJobRecord['status'], patch: any): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = status;
      job.updatedAt = new Date().toISOString();
      if (patch.startedAt) job.startedAt = patch.startedAt;
      if (patch.completedAt) job.completedAt = patch.completedAt;
      if (patch.failedAt) job.failedAt = patch.failedAt;
      if (patch.metadata) job.metadata = patch.metadata;
      if (typeof patch.attempts === 'number') job.attempts = patch.attempts;
    }
  }

  async updateCommandStatus(commandId: string, status: OrchestratorCommandRecord['status'], patch: any): Promise<void> {
    const envelope = this.envelopes.get(commandId);
    if (envelope) {
      envelope.command.status = status;
      if (patch.result) envelope.command.result = patch.result;
      if (patch.metadata) envelope.command.metadata = patch.metadata;
      if (patch.startedAt) envelope.command.startedAt = patch.startedAt;
      if (patch.completedAt) envelope.command.completedAt = patch.completedAt;
      if (patch.failedAt) envelope.command.failedAt = patch.failedAt;
    }
  }

  listOrgConnectors(orgId: string): Promise<OrgConnectorRecord[]> {
    return Promise.resolve(this.connectors.filter((connector) => connector.orgId === orgId));
  }

  async registerConnector(input: RegisterConnectorInput): Promise<string> {
    const id = `connector-${this.connectors.length + 1}`;
    const now = new Date().toISOString();
    this.connectors.push({
      id,
      orgId: input.orgId,
      connectorType: input.connectorType,
      name: input.name,
      status: input.status ?? 'pending',
      config: input.config ?? {},
      metadata: input.metadata ?? {},
      lastSyncedAt: null,
      lastError: null,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  async getJobById(jobId: string): Promise<OrchestratorJobRecord | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async getCommandMetadata(commandId: string): Promise<{ commandType: string; payload: Record<string, unknown> } | null> {
    return this.metadata.get(commandId) ?? null;
  }
}

class StubAIGateway implements OrchestratorAIGateway {
  constructor(private readonly result: { status: 'approved' | 'needs_hitl' | 'rejected'; reasons?: string[]; mitigations?: string[] }) {}

  async runSafetyAssessment(_envelope?: OrchestratorCommandEnvelope): Promise<any> {
    return { status: this.result.status, reasons: this.result.reasons ?? [], mitigations: this.result.mitigations ?? [] };
  }
}

async function buildApp(repository: StubRepository, ai: OrchestratorAIGateway) {
  const supabase = {} as SupabaseClient;
  const result = await createApp({
    supabase,
    overrides: {
      orchestratorRepository: repository,
      orchestratorAIGateway: ai,
    },
  });
  registerOrchestratorRoutes(result.app, result.context);
  return result;
}

describe('Orchestrator routes integration', () => {
  let repository: StubRepository;

  beforeEach(() => {
    repository = new StubRepository();
  });

  it('lists orchestrator commands', async () => {
    await repository.enqueueDirectorCommand({
      orgId: 'org-1',
      commandType: 'test.command',
      name: 'noop',
    } as any);
    const { app } = await buildApp(repository, new StubAIGateway({ status: 'approved' }));
    const response = await app.inject({
      method: 'GET',
      url: '/agent/sessions/session-1/commands?orgId=org-1',
      headers: { 'x-user-id': 'user-1' },
    });
    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.commands).toHaveLength(1);
    await app.close();
  });

  it('rejects command when safety fails', async () => {
    const { app } = await buildApp(repository, new StubAIGateway({ status: 'rejected', reasons: ['policy'] }));
    const response = await app.inject({
      method: 'POST',
      url: '/agent/commands',
      headers: { 'x-user-id': 'user-1' },
      payload: {
        orgId: 'org-1',
        commandType: 'test.command',
      },
    });
    expect(response.statusCode).toBe(409);
    const body = response.json();
    expect(body.error).toBe('command_rejected');
    await app.close();
  });

  it('completes jobs and updates statuses', async () => {
    const enqueue = await repository.enqueueDirectorCommand({
      orgId: 'org-1',
      commandType: 'finance.domain',
      payload: { foo: 'bar' },
      name: 'noop',
    } as any);
    const job = await repository.getJobById(enqueue.jobId);
    if (!job) {
      throw new Error('job missing');
    }
    const { app } = await buildApp(repository, new StubAIGateway({ status: 'approved' }));
    const response = await app.inject({
      method: 'POST',
      url: `/agent/jobs/${job.id}/complete`,
      headers: { 'x-user-id': 'user-1' },
      payload: {
        status: 'completed',
        result: { ok: true },
      },
    });
    expect(response.statusCode).toBe(200);
    const envelope = repository.envelopes.get(enqueue.commandId);
    expect(envelope?.command.status).toBe('completed');
    await app.close();
  });
});

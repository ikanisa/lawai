import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  OrchestratorCommandEnvelope,
  OrchestratorCommandRecord,
  OrchestratorJobRecord,
  OrchestratorSessionRecord,
  OrgConnectorRecord,
  OrchestratorCommandResponse,
} from '@avocat-ai/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createApp } from '../../src/app.js';
import { registerOrchestratorRoutes } from '../../src/http/routes/orchestrator.js';
import type { OrchestratorAIGateway, OrchestratorRepository } from '../../src/core/repositories/orchestrator-repository.js';
import type { DirectorCommandInput, RegisterConnectorInput } from '../../src/orchestrator.js';

process.env.NODE_ENV = 'test';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role';
process.env.SUPABASE_SERVICE_URL = process.env.SUPABASE_SERVICE_URL ?? 'http://localhost:54321';

vi.mock('../../src/access-control.ts', () => ({
  authorizeAction: vi.fn(async (_action: string, orgId: string, userId: string) => ({
    orgId,
    userId,
    role: 'admin',
    policies: { confidentialMode: false },
  })),
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
      directorState: {},
      safetyState: {},
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

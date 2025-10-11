import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NODE_ENV = 'test';

const supabaseMock = { from: vi.fn(), rpc: vi.fn() };

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient: () => supabaseMock,
}));

vi.mock('../src/orchestrator.ts', () => ({
  enqueueDirectorCommand: vi.fn(async () => ({ commandId: 'cmd-1', jobId: 'job-1', sessionId: 'sess-1', status: 'queued', scheduledFor: new Date().toISOString() })),
  getCommandEnvelope: vi.fn(async () => ({
    command: { id: 'cmd-1', status: 'queued', metadata: {} },
    job: { id: 'job-1', status: 'pending', metadata: {} },
  })),
  runSafetyAssessment: vi.fn(async () => ({ status: 'approved', reasons: [], mitigations: [] })),
  updateCommandStatus: vi.fn(async () => undefined),
  updateJobStatus: vi.fn(async () => undefined),
  listCommandsForSession: vi.fn(async () => []),
  listOrgConnectors: vi.fn(async () => []),
  registerConnector: vi.fn(async () => 'connector-1'),
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

// avoid device session writes noise
vi.mock('../src/device-sessions.ts', () => ({ recordDeviceSession: vi.fn(async () => undefined) }));

const { app } = await import('../src/server.ts');

describe('Orchestrator command route', () => {
  beforeEach(() => {
    supabaseMock.from.mockReset();
    supabaseMock.rpc.mockReset();
  });

  it('requires x-user-id header', async () => {
    const response = await app.inject({ method: 'POST', url: '/agent/commands', payload: {} });
    expect(response.statusCode).toBe(400);
  });

  it('accepts valid payload', async () => {
    const payload = { orgId: 'org-1', commandType: 'sync_connector', payload: {} };
    const response = await app.inject({ method: 'POST', url: '/agent/commands', payload, headers: { 'x-user-id': 'user-1' } });
    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.commandId).toBe('cmd-1');
    expect(body.status).toBe('queued');
  });
});


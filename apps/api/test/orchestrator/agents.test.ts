import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { FinanceDirectorPlan, FinanceSafetyReview, OrchestratorCommandEnvelope, OrchestratorSessionRecord } from '@avocat-ai/shared';

vi.mock('../../src/config.js', () => ({
  env: {
    OPENAI_API_KEY: 'test-key',
    AGENT_MODEL: 'gpt-4o-mini',
  },
}));

const runMock = vi.fn();

vi.mock('@openai/agents', () => ({
  Agent: vi.fn().mockImplementation((options: unknown) => ({ options })),
  OpenAIProvider: vi.fn(),
  run: (...args: unknown[]) => runMock(...args),
  setDefaultModelProvider: vi.fn(),
  setDefaultOpenAIKey: vi.fn(),
  setOpenAIAPI: vi.fn(),
}));

import { runDirectorPlanning, runSafetyAssessment } from '../../src/orchestrator.js';
import * as OpenAIModule from '../../src/openai.js';

const { resetOpenAIClientFactories, setOpenAIClientFactory, logOpenAIDebug } = OpenAIModule;

describe('runDirectorPlanning', () => {
  const supabase = {} as SupabaseClient;

  const session: OrchestratorSessionRecord = {
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
  };

  beforeEach(() => {
    runMock.mockReset();
    setOpenAIClientFactory(() => ({}) as any);
  });

  afterEach(() => {
    resetOpenAIClientFactories();
    vi.clearAllMocks();
  });

  it('drains streaming responses before returning the final plan', async () => {
    let consumed = 0;
    let streamClosed = false;
    async function* stream() {
      try {
        yield { type: 'response.output_text.delta', delta: 'chunk-1' };
        consumed += 1;
        yield { type: 'response.output_text.delta', delta: 'chunk-2' };
        consumed += 1;
      } finally {
        streamClosed = true;
      }
    }

    const plan: FinanceDirectorPlan = {
      version: '2025.03',
      objective: 'Close Q2 books',
      summary: 'Plan with streaming support',
      decisionLog: ['objective-validated'],
      steps: [
        {
          id: 'step-1',
          status: 'pending',
          envelope: {
            worker: 'domain',
            commandType: 'finance.accounts_payable.reconcile',
            title: 'Reconcile ledgers',
            description: 'Match invoices with payments.',
            domain: 'accounts_payable',
            payload: {},
            successCriteria: ['ledgers balanced'],
            dependencies: [],
            connectorDependencies: [],
            telemetry: [],
            guardrails: { safetyPolicies: [], residency: [] },
            hitl: { required: false, reasons: [], mitigations: [] },
            budget: { tokens: 4 },
          },
          notes: [],
        },
      ],
      globalHitl: { required: false, reasons: [], mitigations: [] },
    };

    runMock.mockResolvedValueOnce({ finalOutput: plan, stream: stream() });

    const result = await runDirectorPlanning(supabase, session, 'Close Q2 books', {});

    expect(result).toEqual(plan);
    expect(consumed).toBe(2);
    expect(streamClosed).toBe(true);
  });

  it('throws when a plan exceeds budget limits and logs debug details', async () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const budgetPlan: FinanceDirectorPlan = {
      version: '2025.04',
      objective: 'Budget heavy',
      summary: 'Plan exceeding tokens',
      decisionLog: [],
      steps: [
        {
          id: 'step-budget',
          status: 'pending',
          envelope: {
            worker: 'domain',
            commandType: 'finance.audit.escalate',
            title: 'Escalate audit',
            description: 'Heavy budget usage',
            domain: 'audit',
            payload: {},
            successCriteria: ['escalated'],
            dependencies: [],
            connectorDependencies: [],
            telemetry: [],
            guardrails: { safetyPolicies: [], residency: [] },
            hitl: { required: false, reasons: [], mitigations: [] },
            budget: { tokens: 256 },
          },
          notes: [],
        },
      ],
      globalHitl: { required: false, reasons: [], mitigations: [] },
    };

    const debugSpy = vi.spyOn(OpenAIModule, 'logOpenAIDebug');
    runMock.mockResolvedValueOnce({ finalOutput: budgetPlan });

    await expect(runDirectorPlanning(supabase, session, 'Budget heavy', {}, logger)).rejects.toThrow(
      'director_plan_budget_exceeded',
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ stepId: 'step-budget', tokens: 256, limit: expect.any(Number) }),
      'director_plan_budget_exceeded',
    );
    expect(debugSpy).toHaveBeenCalledWith('director_plan', expect.any(Error), logger);
  });
});

describe('runSafetyAssessment', () => {
  const supabase = {} as SupabaseClient;

  const session: OrchestratorSessionRecord = {
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
  };

  const envelope: OrchestratorCommandEnvelope = {
    command: {
      id: 'cmd-1',
      orgId: session.orgId,
      sessionId: session.id,
      commandType: 'finance.accounts_payable.reconcile',
      payload: {},
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
    job: {
      id: 'job-1',
      orgId: session.orgId,
      commandId: 'cmd-1',
      worker: 'safety',
      domainAgent: null,
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
    session,
  };

  beforeEach(() => {
    runMock.mockReset();
    setOpenAIClientFactory(() => ({}) as any);
  });

  afterEach(() => {
    resetOpenAIClientFactories();
    vi.clearAllMocks();
  });

  it('returns a HITL escalation when the agent throws and logs the failure', async () => {
    const logger = { error: vi.fn(), warn: vi.fn() };
    const debugSpy = vi.spyOn(OpenAIModule, 'logOpenAIDebug');
    runMock.mockRejectedValueOnce(new Error('stream disconnected'));

    const result = await runSafetyAssessment(supabase, envelope, logger);

    expect(result.status).toBe('needs_hitl');
    expect(result.reasons).toContain('Safety agent failure, escalate to human');
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ err: 'stream disconnected', commandId: 'cmd-1' }),
      'safety_review_failed',
    );
    expect(debugSpy).toHaveBeenCalledWith('safety_review', expect.any(Error), logger);
  });

  it('parses safety approvals from the agent output', async () => {
    const review: FinanceSafetyReview = {
      command: {
        id: 'cmd-1',
        worker: 'director',
        commandType: 'finance.accounts_payable.reconcile',
        payloadFingerprint: 'fp',
        hitl: { required: false, reasons: [], mitigations: [] },
      },
      envelope: { sessionId: session.id, orgId: session.orgId, jobId: envelope.job.id },
      decision: { status: 'approved', reasons: ['policy_ok'], mitigations: [], hitlRequired: false },
    };

    runMock.mockResolvedValueOnce({ finalOutput: review });

    const result = await runSafetyAssessment(supabase, envelope);

    expect(result.status).toBe('approved');
    expect(result.reasons).toContain('policy_ok');
  });
});

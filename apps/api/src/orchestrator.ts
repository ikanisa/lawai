import type { SupabaseClient } from '@supabase/supabase-js';
import {
  FinanceAgentKernel,
  enqueueDirectorCommand as enqueueDirectorCommandKernel,
  getCommandEnvelope as getCommandEnvelopeKernel,
  listCommandsForSession as listCommandsForSessionKernel,
  listOrgConnectors as listOrgConnectorsKernel,
  listPendingJobs as listPendingJobsKernel,
  registerConnector as registerConnectorKernel,
  updateCommandStatus as updateCommandStatusKernel,
  updateJobStatus as updateJobStatusKernel,
  updateSessionState as updateSessionStateKernel,
  type AgentKernelOptions,
  type KernelLogger,
  type SafetyFilter,
  type PolicyGate,
} from '@avocat-ai/agent-kernel';
import type {
  DirectorCommandInput,
  FinanceDirectorPlan,
  OrchestratorCommandEnvelope,
  OrchestratorCommandRecord,
  OrchestratorCommandResponse,
  OrchestratorJobRecord,
  OrgConnectorRecord,
  SafetyAssessmentResult,
} from '@avocat-ai/shared';
import { logAuditEvent } from './audit.js';
import { env } from './config.js';
import { logOpenAIDebug } from './openai.js';

export type OrchestratorLogger = KernelLogger;

export interface RegisterConnectorInput {
  orgId: string;
  connectorType: OrgConnectorRecord['connectorType'];
  name: string;
  config?: Record<string, unknown>;
  status?: OrgConnectorRecord['status'];
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

const kernelLogger: KernelLogger = {
  error: (data, message) => {
    console.error(`[agent-kernel] ${message}`, data);
  },
  warn: (data, message) => {
    console.warn(`[agent-kernel] ${message}`, data);
  },
  info: (data, message) => {
    console.info(`[agent-kernel] ${message}`, data);
  },
};

let activeLogger: KernelLogger = kernelLogger;

function bindLogger(logger?: OrchestratorLogger): () => void {
  if (!logger) {
    activeLogger = kernelLogger;
    return () => {};
  }
  const previous = {
    error: kernelLogger.error,
    warn: kernelLogger.warn,
    info: kernelLogger.info,
    active: activeLogger,
  };
  kernelLogger.error = logger.error;
  kernelLogger.warn = logger.warn;
  kernelLogger.info = logger.info;
  activeLogger = logger;
  return () => {
    kernelLogger.error = previous.error;
    kernelLogger.warn = previous.warn;
    kernelLogger.info = previous.info;
    activeLogger = previous.active;
  };
}

const highRiskPreFilter: SafetyFilter = ({ envelope }) => {
  const risk = (envelope.command.metadata ?? {}).riskLevel ?? (envelope.command.payload ?? {}).riskLevel;
  if (risk === 'critical') {
    return {
      action: 'needs_hitl',
      reasons: ['Critical risk command requires HITL review'],
    };
  }
  return undefined;
};

const embargoPreFilter: SafetyFilter = ({ envelope }) => {
  const jurisdiction = (envelope.command.metadata ?? {}).jurisdiction;
  if (typeof jurisdiction === 'string' && /embargo/i.test(jurisdiction)) {
    return {
      action: 'block',
      reasons: ['Command references embargoed jurisdiction'],
    };
  }
  return undefined;
};

const hitlOverridePostFilter: SafetyFilter = ({ envelope, result }) => {
  if (result?.status === 'approved' && (envelope.command.metadata ?? {}).forceHitl === true) {
    return {
      action: 'needs_hitl',
      reasons: ['Command flagged for HITL override'],
    };
  }
  return undefined;
};

const suspendedSessionPolicyGate: PolicyGate = ({ session }) => {
  if (session.status === 'suspended') {
    return {
      action: 'block',
      reason: 'session_suspended',
    };
  }
  return undefined;
};

const policyVersionGate: PolicyGate = ({ session }) => {
  const sessionPolicy = session.metadata?.policyVersion;
  const currentPolicy = env.POLICY_VERSION;
  if (sessionPolicy && currentPolicy && sessionPolicy !== currentPolicy) {
    return {
      action: 'block',
      reason: 'policy_version_mismatch',
      metadata: { sessionPolicy, currentPolicy },
    };
  }
  return undefined;
};

const auditLogger: AgentKernelOptions['auditLogger'] = {
  async record(entry) {
    await logAuditEvent({
      orgId: entry.orgId,
      actorId: null,
      kind: `orchestrator.${entry.event}`,
      object: entry.sessionId,
      metadata: {
        actor: entry.actor,
        outcome: entry.outcome,
        detail: entry.detail,
        ...entry.metadata,
      },
    });
  },
};

const kernel = new FinanceAgentKernel({
  model: env.AGENT_MODEL,
  openAIKey: env.OPENAI_API_KEY,
  llmTimeoutMs: env.AGENT_LLM_TIMEOUT_MS,
  logger: kernelLogger,
  auditLogger,
  preSafetyFilters: [highRiskPreFilter, embargoPreFilter],
  postSafetyFilters: [hitlOverridePostFilter],
  policyGates: [suspendedSessionPolicyGate, policyVersionGate],
  onLLMError: (operation, error) => logOpenAIDebug(operation, error, activeLogger),
});

export async function runDirectorPlanning(
  _supabase: SupabaseClient,
  session: OrchestratorCommandEnvelope['session'],
  objective: string,
  context: Record<string, unknown>,
  logger?: OrchestratorLogger,
): Promise<FinanceDirectorPlan> {
  const restore = bindLogger(logger);
  try {
    return await kernel.runDirectorPlanning({ session, objective, context });
  } finally {
    restore();
  }
}

export async function runSafetyAssessment(
  _supabase: SupabaseClient,
  envelope: OrchestratorCommandEnvelope,
  logger?: OrchestratorLogger,
): Promise<SafetyAssessmentResult> {
  const restore = bindLogger(logger);
  try {
    const { result } = await kernel.runSafetyAssessment({ envelope });
    return result;
  } finally {
    restore();
  }
}

export function getCommandEnvelope(
  supabase: SupabaseClient,
  commandId: string,
): Promise<OrchestratorCommandEnvelope> {
  return getCommandEnvelopeKernel(supabase, commandId);
}

export function enqueueDirectorCommand(
  supabase: SupabaseClient,
  input: DirectorCommandInput,
  logger?: OrchestratorLogger,
): Promise<OrchestratorCommandResponse> {
  return enqueueDirectorCommandKernel(supabase, input, logger);
}

export function listPendingJobs(
  supabase: SupabaseClient,
  orgId: string,
  worker: OrchestratorJobRecord['worker'],
  limit = 10,
): Promise<OrchestratorCommandEnvelope[]> {
  return listPendingJobsKernel(supabase, orgId, worker, limit);
}

export function listCommandsForSession(
  supabase: SupabaseClient,
  sessionId: string,
  limit = 50,
): Promise<OrchestratorCommandRecord[]> {
  return listCommandsForSessionKernel(supabase, sessionId, limit);
}

export function listOrgConnectors(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgConnectorRecord[]> {
  return listOrgConnectorsKernel(supabase, orgId);
}

export function updateCommandStatus(
  supabase: SupabaseClient,
  commandId: string,
  status: OrchestratorCommandRecord['status'],
  patch: Record<string, unknown>,
): Promise<void> {
  return updateCommandStatusKernel(supabase, commandId, status, patch);
}

export function updateJobStatus(
  supabase: SupabaseClient,
  jobId: string,
  status: OrchestratorJobRecord['status'],
  patch: Partial<{
    attempts: number;
    lastError: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    metadata: Record<string, unknown>;
  }>,
): Promise<void> {
  return updateJobStatusKernel(supabase, jobId, status, patch);
}

export function registerConnector(
  supabase: SupabaseClient,
  input: RegisterConnectorInput,
): Promise<string> {
  return registerConnectorKernel(supabase, input);
}

export function updateSessionState(
  supabase: SupabaseClient,
  input: Parameters<typeof updateSessionStateKernel>[1],
): Promise<void> {
  return updateSessionStateKernel(supabase, input);
}

import type {
  DirectorCommandInput,
  FinanceDirectorPlan,
  OrchestratorCommandEnvelope,
  OrchestratorCommandRecord,
  OrchestratorCommandResponse,
  OrchestratorJobRecord,
  OrchestratorSessionRecord,
  OrgConnectorRecord,
  SafetyAssessmentResult,
} from '@avocat-ai/shared';

export interface KernelLogger {
  error: (data: Record<string, unknown>, message: string) => void;
  warn?: (data: Record<string, unknown>, message: string) => void;
  info?: (data: Record<string, unknown>, message: string) => void;
}

export interface AuditLogEntry {
  event: 'director_plan' | 'safety_assessment' | 'safety_filter' | 'policy_gate';
  orgId: string;
  sessionId: string;
  actor: 'director' | 'safety' | 'kernel';
  outcome: 'success' | 'error' | 'blocked' | 'needs_hitl';
  detail?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogger {
  record(entry: AuditLogEntry): Promise<void> | void;
}

export type SafetyFilterAction = 'allow' | 'block' | 'needs_hitl';

export interface SafetyFilterDecision {
  action: SafetyFilterAction;
  reasons?: string[];
  mitigations?: string[];
  metadata?: Record<string, unknown>;
}

export interface SafetyFilterContext {
  phase: 'pre' | 'post';
  envelope: OrchestratorCommandEnvelope;
  result?: SafetyAssessmentResult;
}

export type SafetyFilter = (context: SafetyFilterContext) =>
  | SafetyFilterDecision
  | void
  | Promise<SafetyFilterDecision | void>;

export interface PolicyGateDecision {
  action: 'allow' | 'block';
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface PolicyGateContext {
  stage: 'director_plan' | 'safety';
  orgId: string;
  session: OrchestratorSessionRecord;
  command?: OrchestratorCommandRecord;
  job?: OrchestratorJobRecord;
  plan?: FinanceDirectorPlan;
  assessment?: SafetyAssessmentResult;
}

export type PolicyGate = (context: PolicyGateContext) =>
  | PolicyGateDecision
  | void
  | Promise<PolicyGateDecision | void>;

export interface AgentKernelOptions {
  model: string;
  openAIKey: string;
  llmTimeoutMs?: number;
  logger?: KernelLogger;
  auditLogger?: AuditLogger;
  preSafetyFilters?: SafetyFilter[];
  postSafetyFilters?: SafetyFilter[];
  policyGates?: PolicyGate[];
  onLLMError?: (operation: string, error: unknown) => Promise<void> | void;
}

export interface DirectorPlanningInput {
  session: OrchestratorSessionRecord;
  objective: string;
  context: Record<string, unknown>;
}

export interface SafetyAssessmentInput {
  envelope: OrchestratorCommandEnvelope;
}

export interface SafetyAssessmentWithFilters {
  result: SafetyAssessmentResult;
  appliedFilters: SafetyFilterDecision[];
}

export interface OrchestratorStore {
  getCommandEnvelope(commandId: string): Promise<OrchestratorCommandEnvelope>;
  enqueueDirectorCommand(input: DirectorCommandInput): Promise<OrchestratorCommandResponse>;
  listPendingJobs(
    orgId: string,
    worker: OrchestratorJobRecord['worker'],
    limit?: number,
  ): Promise<OrchestratorCommandEnvelope[]>;
  listCommandsForSession(
    sessionId: string,
    limit?: number,
  ): Promise<OrchestratorCommandRecord[]>;
  listOrgConnectors(orgId: string): Promise<OrgConnectorRecord[]>;
  updateCommandStatus(
    commandId: string,
    status: OrchestratorCommandRecord['status'],
    patch: Record<string, unknown>,
  ): Promise<void>;
  updateJobStatus(
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
  ): Promise<void>;
  registerConnector(input: {
    orgId: string;
    connectorType: import('@avocat-ai/shared').ConnectorType;
    name: string;
    config?: Record<string, unknown>;
    status?: import('@avocat-ai/shared').ConnectorStatus;
    metadata?: Record<string, unknown>;
    createdBy?: string;
  }): Promise<string>;
}

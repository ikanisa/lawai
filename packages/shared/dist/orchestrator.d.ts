import type { FinanceDirectorPlan, FinanceSafetyReview } from './orchestrator-schemas.js';
export type OrchestratorSessionStatus = 'active' | 'suspended' | 'closed';
export interface OrchestratorSessionRecord {
    id: string;
    orgId: string;
    chatSessionId: string | null;
    status: OrchestratorSessionStatus;
    directorState: FinanceDirectorPlan | null;
    safetyState: FinanceSafetyReview | null;
    metadata: Record<string, unknown>;
    currentObjective: string | null;
    lastDirectorRunId: string | null;
    lastSafetyRunId: string | null;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
}
export type OrchestratorCommandStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export interface OrchestratorCommandRecord {
    id: string;
    orgId: string;
    sessionId: string;
    commandType: string;
    payload: Record<string, unknown>;
    status: OrchestratorCommandStatus;
    priority: number;
    scheduledFor: string;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    result?: Record<string, unknown> | null;
    lastError?: string | null;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export type OrchestratorWorker = 'director' | 'safety' | 'domain';
export type OrchestratorJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface OrchestratorJobRecord {
    id: string;
    orgId: string;
    commandId: string;
    worker: OrchestratorWorker;
    domainAgent: string | null;
    status: OrchestratorJobStatus;
    attempts: number;
    scheduledAt: string;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    lastError: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}
export type ConnectorType = 'erp' | 'tax' | 'accounting' | 'compliance' | 'analytics';
export type ConnectorStatus = 'inactive' | 'pending' | 'active' | 'error';
export interface OrgConnectorRecord {
    id: string;
    orgId: string;
    connectorType: ConnectorType;
    name: string;
    status: ConnectorStatus;
    config: Record<string, unknown>;
    metadata: Record<string, unknown>;
    lastSyncedAt: string | null;
    lastError: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface DirectorCommandInput {
    sessionId: string;
    orgId: string;
    issuedBy: string;
    commandType: string;
    payload?: Record<string, unknown>;
    priority?: number;
    scheduledFor?: string;
    worker?: OrchestratorWorker;
}
export interface DirectorPlanStep {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'running' | 'complete' | 'blocked';
    assignedAgent?: string;
    metadata?: Record<string, unknown>;
}
export interface SafetyAssessmentResult {
    status: 'approved' | 'rejected' | 'needs_hitl';
    reasons: string[];
    mitigations?: string[];
}
export interface OrchestratorCommandResponse {
    commandId: string;
    jobId: string;
    sessionId: string;
    status: OrchestratorCommandStatus;
    scheduledFor: string;
}
export interface OrchestratorCommandEnvelope {
    command: OrchestratorCommandRecord;
    job: OrchestratorJobRecord;
    session: OrchestratorSessionRecord;
}
//# sourceMappingURL=orchestrator.d.ts.map
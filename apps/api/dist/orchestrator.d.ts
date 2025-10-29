import { Agent } from '@openai/agents';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ConnectorStatus, ConnectorType, DirectorCommandInput, FinanceDirectorPlan, FinanceSafetyReview, OrchestratorCommandEnvelope, OrchestratorCommandRecord, OrchestratorCommandResponse, OrchestratorJobRecord, OrchestratorSessionRecord, OrgConnectorRecord, SafetyAssessmentResult } from '@avocat-ai/shared';
export interface OrchestratorLogger {
    error: (data: Record<string, unknown>, message: string) => void;
    warn?: (data: Record<string, unknown>, message: string) => void;
    info?: (data: Record<string, unknown>, message: string) => void;
}
export interface RegisterConnectorInput {
    orgId: string;
    connectorType: ConnectorType;
    name: string;
    config?: Record<string, unknown>;
    status?: ConnectorStatus;
    metadata?: Record<string, unknown>;
    createdBy?: string;
}
export interface UpdateSessionStateInput {
    sessionId: string;
    directorState?: FinanceDirectorPlan | null;
    safetyState?: FinanceSafetyReview | null;
    metadata?: Record<string, unknown>;
    currentObjective?: string | null;
    status?: OrchestratorSessionRecord['status'];
    lastDirectorRunId?: string | null;
    lastSafetyRunId?: string | null;
}
export declare function getDirectorAgent(): Agent;
export declare function getSafetyAgent(): Agent;
export declare function getCommandEnvelope(supabase: SupabaseClient, commandId: string): Promise<OrchestratorCommandEnvelope>;
export declare function enqueueDirectorCommand(supabase: SupabaseClient, input: DirectorCommandInput, logger?: OrchestratorLogger): Promise<OrchestratorCommandResponse>;
export declare function runDirectorPlanning(supabase: SupabaseClient, session: OrchestratorSessionRecord, objective: string, context: Record<string, unknown>, logger?: OrchestratorLogger): Promise<FinanceDirectorPlan>;
export declare function runSafetyAssessment(supabase: SupabaseClient, envelope: OrchestratorCommandEnvelope, logger?: OrchestratorLogger): Promise<SafetyAssessmentResult>;
export declare function listPendingJobs(supabase: SupabaseClient, orgId: string, worker: OrchestratorJobRecord['worker'], limit?: number): Promise<OrchestratorCommandEnvelope[]>;
export declare function listCommandsForSession(supabase: SupabaseClient, sessionId: string, limit?: number): Promise<OrchestratorCommandRecord[]>;
export declare function listOrgConnectors(supabase: SupabaseClient, orgId: string): Promise<OrgConnectorRecord[]>;
export declare function updateCommandStatus(supabase: SupabaseClient, commandId: string, status: OrchestratorCommandRecord['status'], patch: Record<string, unknown>): Promise<void>;
export declare function updateJobStatus(supabase: SupabaseClient, jobId: string, status: OrchestratorJobRecord['status'], patch: Partial<{
    attempts: number;
    lastError: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    metadata: Record<string, unknown>;
}>): Promise<void>;
export declare function registerConnector(supabase: SupabaseClient, input: RegisterConnectorInput): Promise<string>;
export declare function updateSessionState(supabase: SupabaseClient, input: UpdateSessionStateInput): Promise<void>;
//# sourceMappingURL=orchestrator.d.ts.map
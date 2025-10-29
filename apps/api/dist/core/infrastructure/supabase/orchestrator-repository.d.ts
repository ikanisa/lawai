import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrchestratorRepository } from '../../repositories/orchestrator-repository.js';
import type { DirectorCommandInput, OrchestratorCommandEnvelope, OrchestratorCommandRecord, OrchestratorCommandResponse, OrchestratorJobRecord, OrgConnectorRecord } from '@avocat-ai/shared';
import type { RegisterConnectorInput } from '../../../orchestrator.js';
export declare class SupabaseOrchestratorRepository implements OrchestratorRepository {
    private readonly client;
    constructor(client: SupabaseClient);
    listCommandsForSession(sessionId: string, limit: number): Promise<OrchestratorCommandRecord[]>;
    enqueueDirectorCommand(input: DirectorCommandInput): Promise<OrchestratorCommandResponse>;
    getCommandEnvelope(commandId: string): Promise<OrchestratorCommandEnvelope>;
    listPendingJobs(orgId: string, worker: OrchestratorJobRecord['worker'], limit: number): Promise<OrchestratorCommandEnvelope[]>;
    updateJobStatus(jobId: string, status: OrchestratorJobRecord['status'], patch: Partial<{
        attempts: number;
        lastError: string | null;
        startedAt: string | null;
        completedAt: string | null;
        failedAt: string | null;
        metadata: Record<string, unknown>;
    }>): Promise<void>;
    updateCommandStatus(commandId: string, status: OrchestratorCommandRecord['status'], patch: Record<string, unknown>): Promise<void>;
    listOrgConnectors(orgId: string): Promise<OrgConnectorRecord[]>;
    registerConnector(input: RegisterConnectorInput): Promise<string>;
    getJobById(jobId: string): Promise<OrchestratorJobRecord | null>;
    getCommandMetadata(commandId: string): Promise<{
        commandType: string;
        payload: Record<string, unknown>;
    } | null>;
}
//# sourceMappingURL=orchestrator-repository.d.ts.map
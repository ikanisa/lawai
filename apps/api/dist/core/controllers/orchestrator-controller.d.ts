import type { OrchestratorCommandRecord, OrchestratorJobRecord } from '@avocat-ai/shared';
import type { OrchestratorLogger, RegisterConnectorInput } from '../../orchestrator.js';
import type { OrchestratorService } from '../services/orchestrator-service.js';
export interface ControllerResponse<T = unknown> {
    status: number;
    body?: T;
}
export declare class OrchestratorController {
    private readonly service;
    constructor(service: OrchestratorService);
    listSessionCommands(params: {
        sessionId: string;
        limit?: number;
    }): Promise<ControllerResponse<{
        commands: OrchestratorCommandRecord[];
    }>>;
    createCommand(input: {
        orgId: string;
        sessionId?: string | null;
        commandType: string;
        payload?: Record<string, unknown> | null;
        priority?: number;
        scheduledFor?: string | null;
        worker?: 'director' | 'safety' | 'domain';
        issuedBy: string;
    }, logger?: OrchestratorLogger): Promise<ControllerResponse>;
    getCapabilities(orgId: string): Promise<ControllerResponse>;
    registerConnector(input: RegisterConnectorInput): Promise<ControllerResponse>;
    claimJob(input: {
        orgId: string;
        worker: OrchestratorJobRecord['worker'];
        userId: string;
        limit?: number;
    }): Promise<ControllerResponse>;
    getJob(jobId: string): Promise<OrchestratorJobRecord | null>;
    completeJob(input: {
        job: OrchestratorJobRecord;
        status: OrchestratorJobRecord['status'];
        result?: Record<string, unknown> | null;
        error?: string | null;
        userId: string;
    }): Promise<ControllerResponse>;
}
//# sourceMappingURL=orchestrator-controller.d.ts.map
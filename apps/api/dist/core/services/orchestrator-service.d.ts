import type { DirectorCommandInput, OrchestratorCommandEnvelope, OrchestratorCommandRecord, OrchestratorCommandResponse, OrchestratorJobRecord, SafetyAssessmentResult } from '@avocat-ai/shared';
import type { OrchestratorLogger, RegisterConnectorInput } from '../../orchestrator.js';
import type { OrchestratorAIGateway, OrchestratorRepository } from '../repositories/orchestrator-repository.js';
interface CreateCommandInput extends Omit<DirectorCommandInput, 'issuedBy'> {
    issuedBy: string;
}
export type CommandCreationOutcome = {
    kind: 'accepted';
    response: OrchestratorCommandResponse;
    safety: SafetyAssessmentResult;
} | {
    kind: 'rejected';
    reasons: string[];
    mitigations: string[];
};
export interface ClaimJobInput {
    orgId: string;
    worker: OrchestratorJobRecord['worker'];
    userId: string;
    limit?: number;
}
export type ClaimJobOutcome = {
    kind: 'claimed';
    envelope: OrchestratorCommandEnvelope;
} | {
    kind: 'none';
};
export interface CompleteJobInput {
    job: OrchestratorJobRecord;
    status: OrchestratorJobRecord['status'];
    result?: Record<string, unknown> | null;
    error?: string | null;
    userId: string;
}
export type CompleteJobOutcome = {
    kind: 'completed';
    status: OrchestratorJobRecord['status'];
} | {
    kind: 'command_not_found';
} | {
    kind: 'invalid_finance_result';
    message: string;
};
export declare class OrchestratorService {
    private readonly repository;
    private readonly aiGateway;
    constructor(repository: OrchestratorRepository, aiGateway: OrchestratorAIGateway);
    listCommandsForSession(sessionId: string, limit?: number): Promise<OrchestratorCommandRecord[]>;
    createCommand(input: CreateCommandInput, logger?: OrchestratorLogger): Promise<CommandCreationOutcome>;
    getCapabilities(orgId: string): Promise<{
        manifest: {
            version: string;
            director: Record<string, unknown>;
            domains: {
                key: string;
                description?: string | undefined;
                displayName?: string | undefined;
                instructions?: string | undefined;
                tools?: Record<string, unknown>[] | undefined;
                datasets?: Record<string, unknown>[] | undefined;
                connectors: {
                    type: string;
                    name: string;
                    purpose?: string | undefined;
                    optional?: boolean | undefined;
                }[];
                guardrails?: Record<string, unknown>[] | undefined;
                telemetry?: string[] | undefined;
                hitlPolicies?: string[] | undefined;
            }[];
        };
        connectors: {
            items: any[];
            coverage: {
                key: string;
                connectors: {
                    type: any;
                    name: any;
                    required: boolean;
                    status: string;
                    purpose: any;
                }[];
                missing: any[];
            }[];
        };
    }>;
    registerConnector(input: RegisterConnectorInput): Promise<string>;
    claimJob(input: ClaimJobInput): Promise<ClaimJobOutcome>;
    getJob(jobId: string): Promise<OrchestratorJobRecord | null>;
    completeJob(input: CompleteJobInput): Promise<CompleteJobOutcome>;
}
export {};
//# sourceMappingURL=orchestrator-service.d.ts.map
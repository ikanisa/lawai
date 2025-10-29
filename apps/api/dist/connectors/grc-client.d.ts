import type { OrchestratorLogger } from '../orchestrator.js';
import { type ConnectorConfig } from './http-client.js';
export interface WalkthroughPayload {
    processName: string;
    summary?: string;
    metadata?: Record<string, unknown>;
}
export interface WalkthroughResponse {
    id: string;
    status: string;
}
export interface RiskRegisterPayload {
    jurisdiction: string;
    severity: string;
    note?: string;
    metadata?: Record<string, unknown>;
}
export interface ControlTestPayload {
    controlId: string;
    result: string;
    metadata?: Record<string, unknown>;
}
export declare class GrcClient {
    private readonly http;
    constructor(config: ConnectorConfig, logger?: OrchestratorLogger);
    createWalkthrough(payload: WalkthroughPayload): Promise<WalkthroughResponse>;
    updatePbc(payload: WalkthroughPayload): Promise<WalkthroughResponse>;
    upsertRisk(payload: RiskRegisterPayload): Promise<{
        id: string;
        status: string;
    }>;
    logControlTest(payload: ControlTestPayload): Promise<{
        id: string;
        status: string;
    }>;
}
//# sourceMappingURL=grc-client.d.ts.map
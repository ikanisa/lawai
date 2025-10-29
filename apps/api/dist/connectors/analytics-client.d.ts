import type { OrchestratorLogger } from '../orchestrator.js';
import { type ConnectorConfig } from './http-client.js';
export interface BoardPackPayload {
    period: string;
    metrics: Record<string, unknown>;
    summary?: string;
}
export interface BoardPackResponse {
    packId: string;
    status: string;
    metrics: Record<string, unknown>;
}
export interface ScenarioPayload {
    scenario: string;
    assumptions: Record<string, unknown>;
    period?: string;
}
export interface ScenarioResponse {
    scenarioId: string;
    status: string;
    outputs: Record<string, unknown>;
}
export declare class AnalyticsClient {
    private readonly http;
    constructor(config: ConnectorConfig, logger?: OrchestratorLogger);
    generateBoardPack(payload: BoardPackPayload): Promise<BoardPackResponse>;
    runScenario(payload: ScenarioPayload): Promise<ScenarioResponse>;
    fetchKpis(params: {
        period: string;
    }): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=analytics-client.d.ts.map
import type { OrchestratorLogger } from '../orchestrator.js';
import { type ConnectorConfig } from './http-client.js';
export interface TaxFilingInput {
    jurisdiction: string;
    period: string;
    amount?: number | null;
    currency?: string | null;
    payload: Record<string, unknown>;
}
export interface TaxFilingResponse {
    submissionId: string;
    status: string;
    submittedAt: string;
}
export interface TaxDeadlineResponse {
    jurisdiction: string;
    period: string;
    dueDate: string | null;
    status: string;
}
export declare class TaxGatewayClient {
    private readonly http;
    constructor(config: ConnectorConfig, logger?: OrchestratorLogger);
    submitFiling(input: TaxFilingInput): Promise<TaxFilingResponse>;
    sendAuditResponse(payload: {
        jurisdiction: string;
        period: string;
        response: string;
        evidenceIds?: string[];
    }): Promise<{
        status: string;
    }>;
    fetchDeadline(jurisdiction: string, period: string): Promise<TaxDeadlineResponse>;
}
//# sourceMappingURL=tax-gateway.d.ts.map
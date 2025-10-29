import type { OrchestratorLogger } from '../orchestrator.js';
import { type ConnectorConfig } from './http-client.js';
export interface RegulatoryFilingPayload {
    jurisdiction: string;
    filingType: string;
    dueDate?: string | null;
    metadata?: Record<string, unknown>;
}
export interface RegulatorySubmissionResponse {
    submissionId: string;
    status: string;
}
export interface RegulatoryStatusResponse {
    jurisdiction: string;
    filingType: string;
    status: string;
    dueDate: string | null;
}
export declare class RegulatoryClient {
    private readonly http;
    constructor(config: ConnectorConfig, logger?: OrchestratorLogger);
    submitFiling(payload: RegulatoryFilingPayload): Promise<RegulatorySubmissionResponse>;
    uploadDocument(body: {
        name: string;
        content: string;
    }): Promise<{
        documentId: string;
    }>;
    fetchStatus(jurisdiction: string, filingType: string): Promise<RegulatoryStatusResponse>;
}
//# sourceMappingURL=regulatory-client.d.ts.map
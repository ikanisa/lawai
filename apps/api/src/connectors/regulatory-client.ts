import type { OrchestratorLogger } from '../orchestrator.js';
import { ConnectorHttpClient, type ConnectorConfig } from './http-client.js';

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

export class RegulatoryClient {
  private readonly http: ConnectorHttpClient;

  constructor(config: ConnectorConfig, logger?: OrchestratorLogger) {
    this.http = new ConnectorHttpClient({ config, logger });
  }

  async submitFiling(payload: RegulatoryFilingPayload): Promise<RegulatorySubmissionResponse> {
    return this.http.post<RegulatorySubmissionResponse>('/filings', payload);
  }

  async uploadDocument(body: { name: string; content: string }): Promise<{ documentId: string }> {
    return this.http.post<{ documentId: string }>('/documents/upload', body);
  }

  async fetchStatus(jurisdiction: string, filingType: string): Promise<RegulatoryStatusResponse> {
    return this.http.get<RegulatoryStatusResponse>(`/filings/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(filingType)}`);
  }
}

import type { OrchestratorLogger } from '../orchestrator.js';
import { ConnectorHttpClient, type ConnectorConfig } from './http-client.js';

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

export class TaxGatewayClient {
  private readonly http: ConnectorHttpClient;

  constructor(config: ConnectorConfig, logger?: OrchestratorLogger) {
    this.http = new ConnectorHttpClient({ config, logger });
  }

  async submitFiling(input: TaxFilingInput): Promise<TaxFilingResponse> {
    const body = {
      jurisdiction: input.jurisdiction,
      period: input.period,
      amount: input.amount,
      currency: input.currency,
      payload: input.payload,
    };
    return this.http.post<TaxFilingResponse>('/filings', body);
  }

  async sendAuditResponse(payload: { jurisdiction: string; period: string; response: string; evidenceIds?: string[] }): Promise<{ status: string }> {
    return this.http.post<{ status: string }>('/audit-responses', payload);
  }

  async fetchDeadline(jurisdiction: string, period: string): Promise<TaxDeadlineResponse> {
    return this.http.get<TaxDeadlineResponse>(`/filings/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(period)}`);
  }
}

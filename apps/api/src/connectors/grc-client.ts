import type { OrchestratorLogger } from '../orchestrator.js';
import { ConnectorHttpClient, type ConnectorConfig } from './http-client.js';

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

export class GrcClient {
  private readonly http: ConnectorHttpClient;

  constructor(config: ConnectorConfig, logger?: OrchestratorLogger) {
    this.http = new ConnectorHttpClient({ config, logger });
  }

  async createWalkthrough(payload: WalkthroughPayload): Promise<WalkthroughResponse> {
    return this.http.post<WalkthroughResponse>('/audit/walkthroughs', payload);
  }

  async updatePbc(payload: WalkthroughPayload): Promise<WalkthroughResponse> {
    return this.http.post<WalkthroughResponse>('/audit/pbc', payload);
  }

  async upsertRisk(payload: RiskRegisterPayload): Promise<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>('/risk/register', payload);
  }

  async logControlTest(payload: ControlTestPayload): Promise<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>('/controls/tests', payload);
  }
}

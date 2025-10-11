import type { OrchestratorLogger } from '../orchestrator.js';
import { ConnectorHttpClient, type ConnectorConfig } from './http-client.js';

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

export class AnalyticsClient {
  private readonly http: ConnectorHttpClient;

  constructor(config: ConnectorConfig, logger?: OrchestratorLogger) {
    this.http = new ConnectorHttpClient({ config, logger });
  }

  async generateBoardPack(payload: BoardPackPayload): Promise<BoardPackResponse> {
    return this.http.post<BoardPackResponse>('/board-packs', payload);
  }

  async runScenario(payload: ScenarioPayload): Promise<ScenarioResponse> {
    return this.http.post<ScenarioResponse>('/scenarios', payload);
  }

  async fetchKpis(params: { period: string }): Promise<Record<string, unknown>> {
    const query = new URLSearchParams({ period: params.period });
    return this.http.get<Record<string, unknown>>('/kpi', { query });
  }
}

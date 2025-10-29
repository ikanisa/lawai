import { ConnectorHttpClient } from './http-client.js';
export class AnalyticsClient {
    http;
    constructor(config, logger) {
        this.http = new ConnectorHttpClient({ config, logger });
    }
    async generateBoardPack(payload) {
        return this.http.post('/board-packs', payload);
    }
    async runScenario(payload) {
        return this.http.post('/scenarios', payload);
    }
    async fetchKpis(params) {
        const query = new URLSearchParams({ period: params.period });
        return this.http.get('/kpi', { query });
    }
}

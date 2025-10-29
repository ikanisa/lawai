import { ConnectorHttpClient } from './http-client.js';
export class GrcClient {
    http;
    constructor(config, logger) {
        this.http = new ConnectorHttpClient({ config, logger });
    }
    async createWalkthrough(payload) {
        return this.http.post('/audit/walkthroughs', payload);
    }
    async updatePbc(payload) {
        return this.http.post('/audit/pbc', payload);
    }
    async upsertRisk(payload) {
        return this.http.post('/risk/register', payload);
    }
    async logControlTest(payload) {
        return this.http.post('/controls/tests', payload);
    }
}

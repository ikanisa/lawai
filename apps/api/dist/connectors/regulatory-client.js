import { ConnectorHttpClient } from './http-client.js';
export class RegulatoryClient {
    http;
    constructor(config, logger) {
        this.http = new ConnectorHttpClient({ config, logger });
    }
    async submitFiling(payload) {
        return this.http.post('/filings', payload);
    }
    async uploadDocument(body) {
        return this.http.post('/documents/upload', body);
    }
    async fetchStatus(jurisdiction, filingType) {
        return this.http.get(`/filings/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(filingType)}`);
    }
}

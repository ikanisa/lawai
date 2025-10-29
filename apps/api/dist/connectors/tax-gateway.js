import { ConnectorHttpClient } from './http-client.js';
export class TaxGatewayClient {
    http;
    constructor(config, logger) {
        this.http = new ConnectorHttpClient({ config, logger });
    }
    async submitFiling(input) {
        const body = {
            jurisdiction: input.jurisdiction,
            period: input.period,
            amount: input.amount,
            currency: input.currency,
            payload: input.payload,
        };
        return this.http.post('/filings', body);
    }
    async sendAuditResponse(payload) {
        return this.http.post('/audit-responses', payload);
    }
    async fetchDeadline(jurisdiction, period) {
        return this.http.get(`/filings/${encodeURIComponent(jurisdiction)}/${encodeURIComponent(period)}`);
    }
}

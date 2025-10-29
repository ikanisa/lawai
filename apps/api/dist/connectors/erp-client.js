import { ConnectorHttpClient } from './http-client.js';
export class ErpPayablesClient {
    http;
    constructor(config, logger) {
        this.http = new ConnectorHttpClient({ config, logger });
    }
    async createInvoice(payload) {
        return this.http.post('/ap/invoices', payload);
    }
    async schedulePayment(payload) {
        return this.http.post('/ap/payments/schedule', payload);
    }
    async fetchInvoice(invoiceId) {
        return this.http.get(`/ap/invoices/${encodeURIComponent(invoiceId)}`);
    }
}

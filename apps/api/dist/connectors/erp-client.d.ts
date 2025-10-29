import type { OrchestratorLogger } from '../orchestrator.js';
import { type ConnectorConfig } from './http-client.js';
export interface InvoicePayload {
    vendor: string;
    invoiceNumber?: string | null;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown>;
}
export interface InvoiceResponse {
    invoiceId: string;
    status: string;
}
export interface PaymentSchedulePayload {
    invoiceId: string;
    scheduledFor: string;
    reference?: string | null;
}
export interface PaymentScheduleResponse {
    scheduleId: string;
    status: string;
}
export declare class ErpPayablesClient {
    private readonly http;
    constructor(config: ConnectorConfig, logger?: OrchestratorLogger);
    createInvoice(payload: InvoicePayload): Promise<InvoiceResponse>;
    schedulePayment(payload: PaymentSchedulePayload): Promise<PaymentScheduleResponse>;
    fetchInvoice(invoiceId: string): Promise<InvoiceResponse>;
}
//# sourceMappingURL=erp-client.d.ts.map
import type { OrchestratorLogger } from '../orchestrator.js';
import { ConnectorHttpClient, type ConnectorConfig } from './http-client.js';

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

export class ErpPayablesClient {
  private readonly http: ConnectorHttpClient;

  constructor(config: ConnectorConfig, logger?: OrchestratorLogger) {
    this.http = new ConnectorHttpClient({ config, logger });
  }

  async createInvoice(payload: InvoicePayload): Promise<InvoiceResponse> {
    return this.http.post<InvoiceResponse>('/ap/invoices', payload);
  }

  async schedulePayment(payload: PaymentSchedulePayload): Promise<PaymentScheduleResponse> {
    return this.http.post<PaymentScheduleResponse>('/ap/payments/schedule', payload);
  }

  async fetchInvoice(invoiceId: string): Promise<InvoiceResponse> {
    return this.http.get<InvoiceResponse>(`/ap/invoices/${encodeURIComponent(invoiceId)}`);
  }
}

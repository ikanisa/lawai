import type { FastifyBaseLogger } from 'fastify';
export interface WhatsAppMessageOptions {
    phoneE164: string;
    code: string;
}
export interface WhatsAppAdapter {
    sendOtp(message: WhatsAppMessageOptions): Promise<void>;
}
export declare function createWhatsAppAdapter(logger?: FastifyBaseLogger): WhatsAppAdapter;
//# sourceMappingURL=whatsapp.d.ts.map
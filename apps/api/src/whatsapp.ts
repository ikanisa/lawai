import type { FastifyBaseLogger } from 'fastify';
import { env } from './config.js';
import { incrementCounter } from './observability/metrics.js';

export interface WhatsAppMessageOptions {
  phoneE164: string;
  code: string;
}

export interface WhatsAppAdapter {
  sendOtp(message: WhatsAppMessageOptions): Promise<void>;
}

function ensureEnv<T extends string | undefined>(value: T, key: string): string {
  if (!value || value.length === 0) {
    throw new Error(`missing_env_${key}`);
  }
  return value;
}

class MetaWhatsAppAdapter implements WhatsAppAdapter {
  constructor(private readonly logger?: FastifyBaseLogger) {}

  async sendOtp({ phoneE164, code }: WhatsAppMessageOptions): Promise<void> {
    const token = ensureEnv(env.WA_TOKEN, 'WA_TOKEN');
    const phoneId = ensureEnv(env.WA_PHONE_NUMBER_ID, 'WA_PHONE_NUMBER_ID');
    const template = ensureEnv(env.WA_TEMPLATE_OTP_NAME, 'WA_TEMPLATE_OTP_NAME');
    const locale = env.WA_TEMPLATE_LOCALE ?? 'fr';

    const body = {
      messaging_product: 'whatsapp',
      to: phoneE164,
      type: 'template',
      template: {
        name: template,
        language: { code: locale },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: code,
              },
            ],
          },
        ],
      },
    };

    let response: Response;

    try {
      response = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(phoneId)}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      this.logger?.error({ err: error }, 'wa_meta_send_error');
      incrementCounter('whatsapp_send_failure', { provider: 'meta', reason: 'network' });
      throw new Error('wa_send_failed');
    }

    if (!response.ok) {
      const payload = await response.text();
      this.logger?.error({ status: response.status, payload }, 'wa_meta_send_failed');
      incrementCounter('whatsapp_send_failure', { provider: 'meta', status: response.status });
      throw new Error('wa_send_failed');
    }
  }
}

class TwilioWhatsAppAdapter implements WhatsAppAdapter {
  constructor(private readonly logger?: FastifyBaseLogger) {}

  async sendOtp({ phoneE164, code }: WhatsAppMessageOptions): Promise<void> {
    const credentials = ensureEnv(env.WA_TOKEN, 'WA_TOKEN');
    const fromNumber = ensureEnv(env.WA_PHONE_NUMBER_ID, 'WA_PHONE_NUMBER_ID');
    const template = env.WA_TEMPLATE_OTP_NAME ?? 'otp_login';

    const [accountSid, authToken] = credentials.includes(':')
      ? credentials.split(':', 2)
      : [credentials, ''];

    if (!authToken) {
      throw new Error('missing_twilio_auth_token');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`;
    const params = new URLSearchParams({
      From: `whatsapp:${fromNumber.startsWith('+') ? fromNumber : `+${fromNumber}`}`,
      To: `whatsapp:${phoneE164}`,
      Body: `Code ${template}: ${code}`,
    });

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        },
        body: params.toString(),
      });
    } catch (error) {
      this.logger?.error({ err: error }, 'wa_twilio_send_error');
      incrementCounter('whatsapp_send_failure', { provider: 'twilio', reason: 'network' });
      throw new Error('wa_send_failed');
    }

    if (!response.ok) {
      const payload = await response.text();
      this.logger?.error({ status: response.status, payload }, 'wa_twilio_send_failed');
      incrementCounter('whatsapp_send_failure', { provider: 'twilio', status: response.status });
      throw new Error('wa_send_failed');
    }
  }
}

class ConsoleAdapter implements WhatsAppAdapter {
  constructor(private readonly logger?: FastifyBaseLogger) {}

  async sendOtp({ phoneE164, code }: WhatsAppMessageOptions): Promise<void> {
    this.logger?.info({ phoneE164, code }, 'wa_console_send');
  }
}

export function createWhatsAppAdapter(logger?: FastifyBaseLogger): WhatsAppAdapter {
  if (!env.WA_TOKEN || !env.WA_PHONE_NUMBER_ID) {
    return new ConsoleAdapter(logger);
  }

  if (env.WA_PROVIDER === 'twilio') {
    return new TwilioWhatsAppAdapter(logger);
  }

  return new MetaWhatsAppAdapter(logger);
}


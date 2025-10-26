import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const originalEnv = { ...process.env };
const originalFetch = global.fetch;

function seedBaseEnv(overrides: Record<string, string>) {
  process.env.OPENAI_API_KEY = 'sk-live-123456';
  process.env.AGENT_MODEL = 'gpt-4o';
  process.env.EMBEDDING_MODEL = 'text-embedding-3-large';
  process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'authorities-fr';
  process.env.SUPABASE_URL = 'https://tenant.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase-service-role';

  Object.assign(process.env, overrides);
}

beforeEach(async () => {
  vi.resetModules();
  const metrics = await import('../src/observability/metrics.js');
  metrics.resetCounters();
});

afterEach(async () => {
  const metrics = await import('../src/observability/metrics.js');
  metrics.resetCounters();

  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);

  if (originalFetch) {
    global.fetch = originalFetch;
  } else {
    delete (global as typeof globalThis & { fetch?: typeof fetch }).fetch;
  }
});

describe('WhatsApp adapters', () => {
  it('sends a Meta template payload with the expected headers', async () => {
    seedBaseEnv({
      WA_PROVIDER: 'meta',
      WA_TOKEN: 'meta-token',
      WA_PHONE_NUMBER_ID: '1234567890',
      WA_TEMPLATE_OTP_NAME: 'otp_login',
      WA_TEMPLATE_LOCALE: 'en',
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { createWhatsAppAdapter } = await import('../src/whatsapp.ts');

    const adapter = createWhatsAppAdapter();
    await adapter.sendOtp({ phoneE164: '+33123456789', code: '123456' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v19.0/1234567890/messages');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({
      Authorization: 'Bearer meta-token',
      'Content-Type': 'application/json',
    });

    const parsedBody = JSON.parse(options?.body as string);
    expect(parsedBody).toEqual({
      messaging_product: 'whatsapp',
      to: '+33123456789',
      type: 'template',
      template: {
        name: 'otp_login',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              {
                type: 'text',
                text: '123456',
              },
            ],
          },
        ],
      },
    });
  });

  it('sends a Twilio request with basic auth and form body', async () => {
    seedBaseEnv({
      WA_PROVIDER: 'twilio',
      WA_TOKEN: 'AC123456789:auth-token',
      WA_PHONE_NUMBER_ID: '+14155550123',
      WA_TEMPLATE_OTP_NAME: 'otp_login',
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { createWhatsAppAdapter } = await import('../src/whatsapp.ts');

    const adapter = createWhatsAppAdapter();
    await adapter.sendOtp({ phoneE164: '+447900000000', code: '654321' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123456789/Messages.json');
    expect(options?.method).toBe('POST');
    expect(options?.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from('AC123456789:auth-token').toString('base64')}`,
    });

    const params = new URLSearchParams(options?.body as string);
    expect(Object.fromEntries(params.entries())).toEqual({
      From: 'whatsapp:+14155550123',
      To: 'whatsapp:+447900000000',
      Body: 'Code otp_login: 654321',
    });
  });

  it('increments a failure metric when the provider responds with an error', async () => {
    seedBaseEnv({
      WA_PROVIDER: 'meta',
      WA_TOKEN: 'meta-token',
      WA_PHONE_NUMBER_ID: '1234567890',
      WA_TEMPLATE_OTP_NAME: 'otp_login',
      WA_TEMPLATE_LOCALE: 'fr',
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, text: async () => 'error' });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { createWhatsAppAdapter } = await import('../src/whatsapp.ts');

    const adapter = createWhatsAppAdapter();
    await expect(adapter.sendOtp({ phoneE164: '+33123456789', code: '123456' })).rejects.toThrowError(
      'wa_send_failed',
    );

    const metrics = await import('../src/observability/metrics.js');

    expect(metrics.getCounterSnapshot()).toContainEqual({
      key: 'whatsapp_send_failure:provider=meta|status=500',
      value: 1,
    });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

afterEach(() => {
  vi.resetModules();
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
});

describe('config environment validation', () => {
  it('fails fast on placeholder secrets in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.AGENT_MODEL = 'gpt-4o';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-large';
    process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'authorities-fr';
    process.env.SUPABASE_URL = 'https://tenant.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';

    await expect(import('../src/config.ts')).rejects.toThrowError(
      /configuration_invalid placeholder=OPENAI_API_KEY/,
    );
  });

  it('accepts production-like values when none look like placeholders', async () => {
    process.env.NODE_ENV = 'production';
    process.env.OPENAI_API_KEY = 'sk-live-123456';
    process.env.AGENT_MODEL = 'gpt-4o';
    process.env.EMBEDDING_MODEL = 'text-embedding-3-large';
    process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'authorities-fr';
    process.env.SUPABASE_URL = 'https://tenant.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'supabase-service-role';

    const configModule = await import('../src/config.ts');

    expect(configModule.env.OPENAI_API_KEY).toBe('sk-live-123456');
  });
});

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

describe('configuration validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('throws when production uses placeholder OpenAI key', async () => {
    process.env.NODE_ENV = 'production';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.SUPABASE_URL = 'https://supabase.production.example';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'real-service-role-key';
    process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'vs_lawai_authorities_prod';

    await expect(import('../src/config')).rejects.toThrowError(
      /configuration_invalid placeholders=\[OPENAI_API_KEY\]/,
    );
  });

  it('throws when a production-critical field is missing', async () => {
    process.env.NODE_ENV = 'production';
    process.env.OPENAI_API_KEY = 'sk-live-1234567890abcdef1234567890abcdef';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'real-service-role-key';
    process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'vs_lawai_authorities_prod';
    delete process.env.SUPABASE_URL;

    await expect(import('../src/config')).rejects.toThrowError(/SUPABASE_URL is required/);
  });
});

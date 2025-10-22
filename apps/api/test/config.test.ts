import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function setBaseEnv() {
  process.env.OPENAI_API_KEY = 'sk-valid-key';
  process.env.SUPABASE_URL = 'https://project.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'super-secret-service-role';
  process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'vs_prod_123';
}

describe('configuration validation', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    process.env.NODE_ENV = 'production';
    setBaseEnv();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('throws when using placeholder vector store IDs in production', async () => {
    process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID = 'vs_test';

    await expect(import('../src/config')).rejects.toThrowError(/configuration_invalid/);
  });

  it('throws when using example Supabase URL in production', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';

    await expect(import('../src/config')).rejects.toThrowError(/configuration_invalid/);
  });

  it('throws when using placeholder Supabase service role key in production', async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';

    await expect(import('../src/config')).rejects.toThrowError(/configuration_invalid/);
  });

  it('allows valid production configuration', async () => {
    const module = await import('../src/config');

    expect(module.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID).toBe('vs_prod_123');
    expect(module.env.SUPABASE_URL).toBe('https://project.supabase.co');
    expect(module.env.SUPABASE_SERVICE_ROLE_KEY).toBe('super-secret-service-role');
  });
});

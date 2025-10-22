import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

const setEnvForTest = (overrides: Record<string, string | undefined> = {}) => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'production',
    OPENAI_API_KEY: 'sk-liveRealisticKey123456789012345678901234567890',
    SUPABASE_URL: 'https://avocat-ai.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'realistic-service-role-key',
    ...overrides,
  } as NodeJS.ProcessEnv;
};

describe('assertProductionEnv', () => {
  beforeEach(() => {
    vi.resetModules();
    setEnvForTest();
  });

  afterEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects placeholder Supabase project domain', async () => {
    setEnvForTest({ SUPABASE_URL: 'https://project.supabase.co' });

    await expect(import('../src/config')).rejects.toThrowError(
      /configuration_invalid.*SUPABASE_URL/,
    );
  });

  it('rejects localhost Supabase URLs', async () => {
    setEnvForTest({ SUPABASE_URL: 'http://localhost:54321' });

    await expect(import('../src/config')).rejects.toThrowError(
      /configuration_invalid.*SUPABASE_URL/,
    );
  });

  it('rejects dummy OpenAI keys with sk- prefixes', async () => {
    setEnvForTest({ OPENAI_API_KEY: 'sk-test-123456' });

    await expect(import('../src/config')).rejects.toThrowError(
      /configuration_invalid.*OPENAI_API_KEY/,
    );
  });

  it('accepts realistic production values', async () => {
    const mod = await import('../src/config');

    expect(mod.env.OPENAI_API_KEY).toBe(
      'sk-liveRealisticKey123456789012345678901234567890',
    );
    expect(mod.env.SUPABASE_URL).toBe('https://avocat-ai.supabase.co');
    expect(mod.env.SUPABASE_SERVICE_ROLE_KEY).toBe('realistic-service-role-key');
  });
});

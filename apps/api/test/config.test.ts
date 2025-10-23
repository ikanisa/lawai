import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_DOMAIN_OVERRIDE_ENTRIES } from '../src/allowlist-override.js';
import { OFFICIAL_DOMAIN_ALLOWLIST } from '@avocat-ai/shared';

const ORIGINAL_ENV = { ...process.env };

const setEnvForTest = (overrides: Record<string, string | undefined> = {}) => {
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: 'production',
    OPENAI_API_KEY: 'sk-liveRealisticKey123456789012345678901234567890',
    SUPABASE_URL: 'https://avocat-ai.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'realistic-service-role-key',
    OPENAI_CHATKIT_PROJECT: 'avocat-ai',
    OPENAI_CHATKIT_SECRET: 'chatkit-secret',
    ...overrides,
  } as NodeJS.ProcessEnv;
};

beforeEach(() => {
  vi.resetModules();
  setEnvForTest();
});

afterEach(() => {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

describe('assertProductionEnv', () => {
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

describe('loadAllowlistOverride', () => {
  it('sanitises override domains from environment configuration', async () => {
    const override = [
      'ohada.org',
      'eur-lex.europa.eu',
      'https://legifrance.gouv.fr/eli/code/123',
      'unknown.example.org',
      'OHADA.ORG',
      'cima-afrique.org',
      'oapi.int',
      'sgg.gov.ma',
      'fedlex.admin.ch',
      'legilux.public.lu',
      'https://canlii.org/en',
      'laws-lois.justice.gc.ca',
      'scc-csc.ca',
      'SCC-CSC.LEXUM.COM',
      'courdecassation.fr',
      'conseil-etat.fr',
      'moniteur.be',
      'justel.fgov.be',
      'https://ejustice.fgov.be',
      'iort.gov.tn',
      'joradp.dz',
      'legimonaco.mc',
      'legisquebec.gouv.qc.ca',
      'bger.ch',
    ];

    setEnvForTest({ JURIS_ALLOWLIST_JSON: JSON.stringify(override) });
    const mod = await import('../src/config');

    expect(mod.loadAllowlistOverride()).toEqual(
      OFFICIAL_DOMAIN_ALLOWLIST.slice(0, MAX_DOMAIN_OVERRIDE_ENTRIES),
    );
  });

  it('returns null when override payload cannot be parsed', async () => {
    setEnvForTest({ JURIS_ALLOWLIST_JSON: '{not-valid-json' });
    const mod = await import('../src/config');

    expect(mod.loadAllowlistOverride()).toBeNull();
  });
});

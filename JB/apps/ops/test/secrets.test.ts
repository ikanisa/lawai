import { describe, expect, it } from 'vitest';
import { auditSecrets } from '../src/lib/secrets.js';

describe('auditSecrets', () => {
  it('flags weak or missing secrets', () => {
    const issues = auditSecrets({
      OPENAI_API_KEY: 'test',
      SUPABASE_SERVICE_ROLE_KEY: 'service',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_URL: 'https://example.supabase.co',
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'OPENAI_API_KEY' }),
        expect.objectContaining({ key: 'SUPABASE_SERVICE_ROLE_KEY' }),
        expect.objectContaining({ key: 'SUPABASE_ANON_KEY' }),
        expect.objectContaining({ key: 'SUPABASE_URL' }),
      ]),
    );
  });

  it('returns an empty array when secrets look production-ready', () => {
    const issues = auditSecrets({
      OPENAI_API_KEY: 'sk-live-1234567890abcdef1234567890abcdef',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-1234567890abcdef1234567890abcd',
      SUPABASE_ANON_KEY: 'anon-1234567890abcdef1234567890abcdef',
      SUPABASE_URL: 'https://myproject.supabase.co',
    });

    expect(issues).toHaveLength(0);
  });
});

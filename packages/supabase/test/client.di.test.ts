import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient, resetServiceClientCache } from '../src/client.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

describe('createServiceClient', () => {
  it('reuses injected client when provided', () => {
    resetServiceClientCache();
    const client = { from: vi.fn() } as unknown as SupabaseClient;
    const instance = createServiceClient(env, { client });
    expect(instance).toBe(client);
  });

  it('supports custom factory', () => {
    resetServiceClientCache();
    const factory = vi.fn(() => ({ id: 'custom' }));
    const instance = createServiceClient(env, { factory });
    expect(factory).toHaveBeenCalled();
    expect(instance).toEqual({ id: 'custom' });
  });
});

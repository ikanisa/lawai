import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseServiceClient } from '../src/types/supabase.js';

process.env.NODE_ENV = 'test';

const supabaseMock = {
  from: vi.fn(),
  rpc: vi.fn(),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      download: vi.fn(),
    })),
  },
} as unknown as SupabaseServiceClient;

const createServiceClient = vi.fn(() => supabaseMock);

vi.mock('@avocat-ai/supabase', () => ({
  createServiceClient,
}));

describe('createApp', () => {
  beforeEach(() => {
    createServiceClient.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('registers core plugins and routes', async () => {
    const { createApp } = await import('../src/app.js');

    const { app } = await createApp();
    await app.ready();

    expect(app.hasRoute({ method: 'POST', url: '/api/agents/run' })).toBe(true);
    expect(app.hasRoute({ method: 'GET', url: '/workspace' })).toBe(true);
    expect(createServiceClient).toHaveBeenCalledTimes(1);

    await app.close();
  });
});

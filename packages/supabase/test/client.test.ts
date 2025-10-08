import { describe, expect, it, vi } from 'vitest';
import { createServiceClient } from '../src/client.js';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn(),
  }),
}));

const { createClient } = await import('@supabase/supabase-js');

describe('createServiceClient', () => {
  it('validates environment configuration', () => {
    const client = createServiceClient({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'secret',
    });

    expect(client).toBeDefined();
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'secret',
      expect.objectContaining({ auth: expect.any(Object) }),
    );
  });

  it('throws for invalid configuration', () => {
    expect(() =>
      createServiceClient({
        SUPABASE_URL: 'not-a-url',
        SUPABASE_SERVICE_ROLE_KEY: '',
      } as never),
    ).toThrowError();
  });
});

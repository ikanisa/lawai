import type { SupabaseClient } from '@supabase/supabase-js';

export function createSupabaseTestClient(): SupabaseClient {
  const noopPromise = Promise.resolve({ data: null, error: null });

  const chain = {
    select: () => chain,
    eq: () => chain,
    or: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => noopPromise,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  } as any;

  return {
    from: () => chain,
    rpc: () => noopPromise,
    channel: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }),
  } as unknown as SupabaseClient;
}

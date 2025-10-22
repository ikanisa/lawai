import { createClient } from '@supabase/supabase-js';

import { clientEnv } from '@/env.client';

type SupabaseClient = ReturnType<typeof createClient>;

let cachedClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'avocat-ai.supabase.auth',
    },
  });

  return cachedClient;
}

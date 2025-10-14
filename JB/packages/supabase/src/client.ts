import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof envSchema>;

let cachedClient: SupabaseClient | null = null;

export function createServiceClient(env: SupabaseEnv): SupabaseClient {
  const parsed = envSchema.parse(env);

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient(parsed.SUPABASE_URL, parsed.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

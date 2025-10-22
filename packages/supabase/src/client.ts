import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { ServiceDatabase, ServiceSupabaseClient } from './types.js';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof envSchema>;

let cachedClient: ServiceSupabaseClient | null = null;

export function createServiceClient(env: SupabaseEnv): ServiceSupabaseClient {
  const parsed = envSchema.parse(env);

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient<ServiceDatabase>(
    parsed.SUPABASE_URL,
    parsed.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return cachedClient;
}

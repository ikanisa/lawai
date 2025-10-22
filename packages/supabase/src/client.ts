import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from './generated/database.types.js';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof envSchema>;

let cachedClient: SupabaseClient<Database> | null = null;

export function createServiceClient(env: SupabaseEnv): SupabaseClient<Database> {
  const parsed = envSchema.parse(env);

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = createClient<Database>(parsed.SUPABASE_URL, parsed.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}

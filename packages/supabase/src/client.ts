import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof envSchema>;

let cachedClient: SupabaseClient | null = null;

export type ServiceClientFactory = (
  url: string,
  serviceKey: string,
  options?: Parameters<typeof createClient>[2],
) => SupabaseClient;

export interface CreateServiceClientOptions {
  factory?: ServiceClientFactory;
  reuseExisting?: boolean;
  client?: SupabaseClient | null;
}

export function createServiceClient(
  env: SupabaseEnv,
  options: CreateServiceClientOptions = {},
): SupabaseClient {
  const parsed = envSchema.parse(env);
  const reuseExisting = options.reuseExisting ?? true;

  if (options.client) {
    if (reuseExisting) {
      cachedClient = options.client;
    }
    return options.client;
  }

  if (reuseExisting && cachedClient) {
    return cachedClient;
  }

  const factory = options.factory ?? createClient;
  const instance = factory(parsed.SUPABASE_URL, parsed.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  if (reuseExisting) {
    cachedClient = instance;
  }

  return instance;
}

export function resetServiceClientCache(): void {
  cachedClient = null;
}

import { createServiceClient } from '@avocat-ai/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from './config.js';

export const supabase: SupabaseClient = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
}) as unknown as SupabaseClient;

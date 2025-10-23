import { createServiceClient } from '@avocat-ai/supabase';
import { env } from './config.js';
import type { SupabaseServiceClient } from './types/supabase.js';

export const supabase: SupabaseServiceClient = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

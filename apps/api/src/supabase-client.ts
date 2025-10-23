import { createServiceClient } from '@avocat-ai/supabase';
import { env } from './config.js';
import type { ServiceSupabaseClient } from './types/supabase';

export const supabase: ServiceSupabaseClient = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

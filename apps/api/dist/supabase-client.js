import { createServiceClient } from '@avocat-ai/supabase';
import { env } from './config.js';
export const supabase = createServiceClient({
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

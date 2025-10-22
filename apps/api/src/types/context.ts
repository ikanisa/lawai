import type { SupabaseClient } from '@supabase/supabase-js';
import type { RateLimitGuard } from '../rate-limit.js';

export interface AppContext {
  supabase: SupabaseClient;
  config: {
    openai: {
      apiKey: string;
      baseUrl?: string;
    };
  };
  rateLimits: {
    workspace?: RateLimitGuard;
  };
}


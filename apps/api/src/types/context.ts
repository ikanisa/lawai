import type { SupabaseClient } from '@supabase/supabase-js';
import type { RateLimiter, RateLimiterFactory } from '../rate-limit';

export interface AppContext {
  supabase: ApiSupabaseClient;
  config: {
    openai: {
      apiKey: string;
      baseUrl?: string;
    };
  };
  rateLimiter: {
    factory: RateLimiterFactory;
    workspace: RateLimiter;
  };
}


import type { RateLimitGuard } from '../rate-limit.js';
import type { SupabaseServiceClient } from './supabase.js';

export interface AppContext {
  supabase: SupabaseServiceClient;
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


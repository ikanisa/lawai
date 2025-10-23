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


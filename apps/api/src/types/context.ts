import type { SupabaseClient } from '@supabase/supabase-js';

export interface AppContext {
  supabase: SupabaseClient;
  config: {
    openai: {
      apiKey: string;
      baseUrl?: string;
    };
  };
}


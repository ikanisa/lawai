import type { ServiceSupabaseClient } from './supabase';

export interface AppContext {
  supabase: ServiceSupabaseClient;
  config: {
    openai: {
      apiKey: string;
      baseUrl?: string;
    };
  };
}


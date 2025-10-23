import type { ApiSupabaseClient } from './supabase';

export interface AppContext {
  supabase: ApiSupabaseClient;
  config: {
    openai: {
      apiKey: string;
      baseUrl?: string;
    };
  };
  container: AppContainer;
}


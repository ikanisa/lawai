import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppContainer } from '../core/container.js';

export interface AppContext {
  supabase: SupabaseClient;
  config: {
    openai: {
      apiKey: string;
      baseUrl?: string;
    };
  };
  container: AppContainer;
}


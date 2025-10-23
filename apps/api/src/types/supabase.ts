import type {
  GeneratedDatabase,
  ServiceDatabase,
  ServiceSupabaseClient,
} from '@avocat-ai/supabase';

export type ApiGeneratedDatabase = GeneratedDatabase;

export type ApiDatabase = ServiceDatabase<ApiGeneratedDatabase>;

export type ApiSupabaseClient = ServiceSupabaseClient<ApiGeneratedDatabase>;

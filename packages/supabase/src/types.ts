import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './generated/database.types.js';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ServiceDatabase<DB extends Database = Database> = DB & {
  __InternalSupabase?: {
    PostgrestVersion?: string;
  };
};

export type ServiceSupabaseClient<DB extends Database = Database> = SupabaseClient<ServiceDatabase<DB>>;

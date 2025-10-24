import type { SupabaseClient } from '@supabase/supabase-js';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ServiceRelationship {
  readonly foreignKeyName?: string;
  readonly columns: readonly string[];
  readonly referencedTable: string;
  readonly referencedColumns: readonly string[];
}

export interface ServiceTable {
  Row: Record<string, Json>;
  Insert: Record<string, Json>;
  Update: Record<string, Json>;
  Relationships: ServiceRelationship[];
}

export interface ServiceView {
  Row: Record<string, Json>;
}

export interface ServiceFunction {
  readonly args: Record<string, Json>;
  readonly returns: Json;
}

export interface ServiceSchema {
  Tables: Record<string, ServiceTable>;
  Views: Record<string, ServiceView>;
  Functions: Record<string, ServiceFunction>;
  Enums: Record<string, readonly string[]>;
  CompositeTypes: Record<string, Record<string, Json>>;
}

export type GeneratedDatabase = {
  public: ServiceSchema;
  [schema: string]: ServiceSchema;
};

export type ServiceDatabase<DB extends GeneratedDatabase = GeneratedDatabase> = DB & {
  __InternalSupabase?: {
    PostgrestVersion?: string;
  };
};

export type ServiceSupabaseClient<DB extends GeneratedDatabase = GeneratedDatabase> = SupabaseClient<
  ServiceDatabase<DB>
>;

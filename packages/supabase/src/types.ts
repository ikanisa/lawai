import type {
  GenericFunction,
  GenericRelationship,
  GenericSchema,
  GenericTable,
  SupabaseClient,
} from '@supabase/supabase-js';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ServiceTable extends GenericTable {
  Row: Record<string, Json>;
  Insert: Record<string, Json>;
  Update: Record<string, Json>;
  Relationships: GenericRelationship[];
}

export interface ServiceView extends GenericSchema['Views'][string] {}

export interface ServiceFunction extends GenericFunction {}

export interface ServiceSchema extends GenericSchema {
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

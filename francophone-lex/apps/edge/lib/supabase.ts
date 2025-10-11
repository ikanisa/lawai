import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.43.5';

type EdgeRow = Record<string, unknown>;

type EdgeTable = {
  Row: EdgeRow;
  Insert: EdgeRow;
  Update: EdgeRow;
};

type EdgeSchema = {
  Tables: Record<string, EdgeTable>;
  Views: Record<string, { Row: EdgeRow }>;
  Functions: Record<string, unknown>;
  Enums: Record<string, string>;
  CompositeTypes: Record<string, EdgeRow>;
};

export type EdgeDatabase = {
  public: EdgeSchema;
};

export type EdgeSupabaseClient = SupabaseClient<EdgeDatabase, 'public', EdgeSchema>;

export function createEdgeClient(url: string, serviceRoleKey: string, options?: Parameters<typeof createClient>[2]): EdgeSupabaseClient {
  return createClient<EdgeDatabase>(url, serviceRoleKey, options) as EdgeSupabaseClient;
}

export function rowAs<T>(row: EdgeRow | null | undefined): T | null {
  return row ? (row as unknown as T) : null;
}

export function rowsAs<T>(rows: readonly EdgeRow[] | null | undefined): T[] {
  return Array.isArray(rows) ? (rows as unknown as T[]) : [];
}

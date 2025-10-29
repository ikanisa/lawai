import type { SupabaseClient } from '@supabase/supabase-js';
export type Json = any;
export interface SupabaseTable<Row = Record<string, Json>> {
    Row: Row;
    Insert: Partial<Row> & Record<string, Json>;
    Update: Partial<Row> & Record<string, Json>;
    Relationships: never[];
}
export interface SupabaseFunction<Args = Record<string, Json>, Returns = unknown> {
    Args: Args;
    Returns: Returns;
}
export interface SupabaseDatabase {
    __InternalSupabase: {
        PostgrestVersion: string;
    };
    public: {
        Tables: Record<string, SupabaseTable>;
        Views: Record<string, SupabaseTable>;
        Functions: Record<string, SupabaseFunction>;
        Enums: Record<string, string | number>;
        CompositeTypes: Record<string, Record<string, Json>>;
    };
}
export type SupabaseServiceClient = SupabaseClient<SupabaseDatabase>;
//# sourceMappingURL=supabase.d.ts.map
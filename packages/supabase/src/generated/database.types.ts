/* eslint-disable */
// This file is auto-generated via `supabase gen types`. Do not edit manually.
// Instead, run `npm run supabase:types` from the repository root after updating the schema.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      admin_audit_events: {
        Row: {
          action: string;
          actor: string;
          created_at: string;
          id: string;
          object: string;
          org_id: string;
          payload_after: Json | null;
          payload_before: Json | null;
        };
        Insert: {
          action: string;
          actor: string;
          created_at?: string;
          id?: string;
          object: string;
          org_id: string;
          payload_after?: Json | null;
          payload_before?: Json | null;
        };
        Update: {
          action?: string;
          actor?: string;
          created_at?: string;
          id?: string;
          object?: string;
          org_id?: string;
          payload_after?: Json | null;
          payload_before?: Json | null;
        };
        Relationships: [];
      };
      admin_agents: {
        Row: {
          id: string;
          name: string;
          org_id: string;
          promoted_at: string;
          status: string;
          tool_count: number;
          version: string;
        };
        Insert: {
          id: string;
          name: string;
          org_id: string;
          promoted_at?: string;
          status: string;
          tool_count?: number;
          version: string;
        };
        Update: {
          id?: string;
          name?: string;
          org_id?: string;
          promoted_at?: string;
          status?: string;
          tool_count?: number;
          version?: string;
        };
        Relationships: [];
      };
      admin_corpus_sources: {
        Row: {
          id: string;
          label: string;
          last_synced_at: string;
          org_id: string;
          quarantine_count: number;
          status: string;
        };
        Insert: {
          id: string;
          label: string;
          last_synced_at?: string;
          org_id: string;
          quarantine_count?: number;
          status: string;
        };
        Update: {
          id?: string;
          label?: string;
          last_synced_at?: string;
          org_id?: string;
          quarantine_count?: number;
          status?: string;
        };
        Relationships: [];
      };
      admin_entitlements: {
        Row: {
          enabled: boolean;
          entitlement: string;
          jurisdiction: string;
          org_id: string;
          updated_at: string;
        };
        Insert: {
          enabled?: boolean;
          entitlement: string;
          jurisdiction: string;
          org_id: string;
          updated_at?: string;
        };
        Update: {
          enabled?: boolean;
          entitlement?: string;
          jurisdiction?: string;
          org_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_evaluations: {
        Row: {
          id: string;
          last_run_at: string;
          name: string;
          org_id: string;
          pass_rate: string;
          slo_gate: string;
          status: string;
        };
        Insert: {
          id: string;
          last_run_at?: string;
          name: string;
          org_id: string;
          pass_rate: string;
          slo_gate: string;
          status?: string;
        };
        Update: {
          id?: string;
          last_run_at?: string;
          name?: string;
          org_id?: string;
          pass_rate?: string;
          slo_gate?: string;
          status?: string;
        };
        Relationships: [];
      };
      admin_hitl_queue: {
        Row: {
          blast_radius: number;
          id: string;
          matter: string;
          org_id: string;
          status: string;
          submitted_at: string;
          summary: string | null;
        };
        Insert: {
          blast_radius?: number;
          id: string;
          matter: string;
          org_id: string;
          status?: string;
          submitted_at?: string;
          summary?: string | null;
        };
        Update: {
          blast_radius?: number;
          id?: string;
          matter?: string;
          org_id?: string;
          status?: string;
          submitted_at?: string;
          summary?: string | null;
        };
        Relationships: [];
      };
      admin_ingestion_tasks: {
        Row: {
          id: string;
          last_error: string | null;
          org_id: string;
          progress: number;
          stage: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          last_error?: string | null;
          org_id: string;
          progress?: number;
          stage: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          last_error?: string | null;
          org_id?: string;
          progress?: number;
          stage?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_jobs: {
        Row: {
          actor: string | null;
          id: string;
          last_error: string | null;
          org_id: string;
          payload: Json | null;
          progress: number;
          status: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          actor?: string | null;
          id?: string;
          last_error?: string | null;
          org_id: string;
          payload?: Json | null;
          progress?: number;
          status?: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          actor?: string | null;
          id?: string;
          last_error?: string | null;
          org_id?: string;
          payload?: Json | null;
          progress?: number;
          status?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      admin_policies: {
        Row: {
          key: string;
          org_id: string;
          updated_at: string;
          updated_by: string;
          value: Json | null;
        };
        Insert: {
          key: string;
          org_id: string;
          updated_at?: string;
          updated_by: string;
          value?: Json | null;
        };
        Update: {
          key?: string;
          org_id?: string;
          updated_at?: string;
          updated_by?: string;
          value?: Json | null;
        };
        Relationships: [];
      };
      admin_telemetry_snapshots: {
        Row: {
          collected_at: string;
          id: string;
          metric: string;
          org_id: string;
          tags: Json | null;
          value: string | null;
        };
        Insert: {
          collected_at?: string;
          id?: string;
          metric: string;
          org_id: string;
          tags?: Json | null;
          value?: string | null;
        };
        Update: {
          collected_at?: string;
          id?: string;
          metric?: string;
          org_id?: string;
          tags?: Json | null;
          value?: string | null;
        };
        Relationships: [];
      };
      admin_users: {
        Row: {
          capabilities: string[];
          email: string;
          id: string;
          invited_at: string;
          last_active: string | null;
          org_id: string;
          role: string;
        };
        Insert: {
          capabilities?: string[];
          email: string;
          id?: string;
          invited_at?: string;
          last_active?: string | null;
          org_id: string;
          role: string;
        };
        Update: {
          capabilities?: string[];
          email?: string;
          id?: string;
          invited_at?: string;
          last_active?: string | null;
          org_id?: string;
          role?: string;
        };
        Relationships: [];
      };
      admin_workflows: {
        Row: {
          draft_diff: Json | null;
          id: string;
          name: string;
          org_id: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
          version: string;
        };
        Insert: {
          draft_diff?: Json | null;
          id: string;
          name: string;
          org_id: string;
          status: string;
          updated_at?: string;
          updated_by?: string | null;
          version: string;
        };
        Update: {
          draft_diff?: Json | null;
          id?: string;
          name?: string;
          org_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          version?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      admin_actor_org: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
}

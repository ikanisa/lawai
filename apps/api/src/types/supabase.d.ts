import type { SupabaseClient } from '@supabase/supabase-js';

type GenericTable<Row = Record<string, any>, Insert = Record<string, any>, Update = Record<string, any>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: never[];
};

type GenericFunction<Args = Record<string, any>, Returns = any> = {
  Args: Args;
  Returns: Returns;
};

export type Database = {
  public: {
    Tables: {
      agent_learning_jobs: GenericTable;
      agent_learning_reports: GenericTable;
      agent_policy_versions: GenericTable;
      agent_runs: GenericTable;
      agent_synonyms: GenericTable;
      agent_task_queue: GenericTable;
      audit_events: GenericTable;
      authority_domains: GenericTable;
      case_score_overrides: GenericTable;
      case_scores: GenericTable;
      case_statute_links: GenericTable;
      case_treatments: GenericTable;
      change_log_entries: GenericTable;
      chat_events: GenericTable;
      chat_sessions: GenericTable;
      compliance_assessments: GenericTable;
      consent_events: GenericTable;
      device_sessions: GenericTable;
      document_chunks: GenericTable;
      document_summaries: GenericTable;
      documents: GenericTable;
      drive_manifests: GenericTable;
      eval_cases: GenericTable;
      eval_results: GenericTable;
      finance_ap_invoices: GenericTable;
      finance_audit_walkthroughs: GenericTable;
      finance_board_packs: GenericTable;
      finance_regulatory_filings: GenericTable;
      finance_risk_control_tests: GenericTable;
      finance_tax_filings: GenericTable;
      fria_artifacts: GenericTable;
      go_no_go_evidence: GenericTable;
      go_no_go_signoffs: GenericTable;
      governance_publications: GenericTable;
      hitl_queue: GenericTable;
      hitl_reviewer_edits: GenericTable;
      incident_reports: GenericTable;
      ingestion_runs: GenericTable;
      ip_allowlist_entries: GenericTable;
      jurisdiction_entitlements: GenericTable;
      jurisdiction_identifier_coverage: GenericTable;
      jurisdictions: GenericTable;
      orchestrator_commands: GenericTable;
      orchestrator_jobs: GenericTable;
      orchestrator_sessions: GenericTable;
      org_connectors: GenericTable;
      org_evaluation_jurisdiction_metrics: GenericTable;
      org_evaluation_metrics: GenericTable;
      org_jurisdiction_provenance: GenericTable;
      org_members: GenericTable;
      org_metrics: GenericTable;
      org_policies: GenericTable;
      org_provenance_metrics: GenericTable;
      org_retrieval_host_metrics: GenericTable;
      org_retrieval_metrics: GenericTable;
      org_retrieval_origin_metrics: GenericTable;
      organizations: GenericTable;
      performance_snapshots: GenericTable;
      pleading_templates: GenericTable;
      profiles: GenericTable;
      red_team_findings: GenericTable;
      regulator_dispatches: GenericTable;
      risk_register: GenericTable;
      run_citations: GenericTable;
      run_retrieval_sets: GenericTable;
      scim_tokens: GenericTable;
      slo_snapshots: GenericTable;
      sources: GenericTable;
      sso_connections: GenericTable;
      tool_invocations: GenericTable;
      tool_performance_metrics: GenericTable;
      tool_telemetry: GenericTable;
      transparency_reports: GenericTable;
      ui_telemetry_events: GenericTable;
    };
    Views: {};
    Functions: {
      enqueue_orchestrator_command: GenericFunction;
      match_chunks: GenericFunction;
      org_residency_allows: GenericFunction;
      record_consent_events: GenericFunction;
      register_org_connector: GenericFunction;
      storage_residency_allowed: GenericFunction;
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ServiceSupabaseClient = SupabaseClient<Database>;

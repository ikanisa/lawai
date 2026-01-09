-- Comprehensive cleanup script for LawAI database
-- Removes all old tables and prepares for new minimal schema
-- Run this before setting up the new schema

-- Drop all existing tables (in dependency order)
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "chat_sessions" CASCADE;
DROP TABLE IF EXISTS "documents" CASCADE;
DROP TABLE IF EXISTS "cases" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "system_settings" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- Drop old system tables
DROP TABLE IF EXISTS "agent_learning_jobs" CASCADE;
DROP TABLE IF EXISTS "agent_learning_reports" CASCADE;
DROP TABLE IF EXISTS "agent_policy_versions" CASCADE;
DROP TABLE IF EXISTS "agent_runs" CASCADE;
DROP TABLE IF EXISTS "agent_synonyms" CASCADE;
DROP TABLE IF EXISTS "agent_task_queue" CASCADE;
DROP TABLE IF EXISTS "agent_tools" CASCADE;
DROP TABLE IF EXISTS "audit_events" CASCADE;
DROP TABLE IF EXISTS "authority_domains" CASCADE;
DROP TABLE IF EXISTS "billing_accounts" CASCADE;
DROP TABLE IF EXISTS "cache" CASCADE;
DROP TABLE IF EXISTS "case_collaborators" CASCADE;
DROP TABLE IF EXISTS "case_documents" CASCADE;
DROP TABLE IF EXISTS "case_messages" CASCADE;
DROP TABLE IF EXISTS "case_score_overrides" CASCADE;
DROP TABLE IF EXISTS "case_scores" CASCADE;
DROP TABLE IF EXISTS "case_statute_links" CASCADE;
DROP TABLE IF EXISTS "case_treatments" CASCADE;
DROP TABLE IF EXISTS "change_log_entries" CASCADE;
DROP TABLE IF EXISTS "citation_canonicalizer" CASCADE;
DROP TABLE IF EXISTS "compliance_assessments" CASCADE;
DROP TABLE IF EXISTS "consent_events" CASCADE;
DROP TABLE IF EXISTS "deletion_requests" CASCADE;
DROP TABLE IF EXISTS "denylist_deboost" CASCADE;
DROP TABLE IF EXISTS "document_chunks" CASCADE;
DROP TABLE IF EXISTS "document_summaries" CASCADE;
DROP TABLE IF EXISTS "drive_manifests" CASCADE;
DROP TABLE IF EXISTS "drive_manifest_items" CASCADE;
DROP TABLE IF EXISTS "eval_cases" CASCADE;
DROP TABLE IF EXISTS "eval_results" CASCADE;
DROP TABLE IF EXISTS "fria_artifacts" CASCADE;
DROP TABLE IF EXISTS "go_no_go_evidence" CASCADE;
DROP TABLE IF EXISTS "go_no_go_signoffs" CASCADE;
DROP TABLE IF EXISTS "governance_publications" CASCADE;
DROP TABLE IF EXISTS "hitl_review_notes" CASCADE;
DROP TABLE IF EXISTS "hitl_reviewer_edits" CASCADE;
DROP TABLE IF EXISTS "incident_reports" CASCADE;
DROP TABLE IF EXISTS "ingestion_jobs" CASCADE;
DROP TABLE IF EXISTS "ingestion_runs" CASCADE;
DROP TABLE IF EXISTS "ingestion_quarantine" CASCADE;
DROP TABLE IF EXISTS "ip_allowlist_entries" CASCADE;
DROP TABLE IF EXISTS "jurisdiction_entitlements" CASCADE;
DROP TABLE IF EXISTS "learning_reports" CASCADE;
DROP TABLE IF EXISTS "learning_reports_fairness" CASCADE;
DROP TABLE IF EXISTS "learning_reports_queue" CASCADE;
DROP TABLE IF EXISTS "learning_snapshots" CASCADE;
DROP TABLE IF EXISTS "org_evaluation_metrics" CASCADE;
DROP TABLE IF EXISTS "org_jurisdiction_provenance_view" CASCADE;
DROP TABLE IF EXISTS "org_metrics" CASCADE;
DROP TABLE IF EXISTS "org_members" CASCADE;
DROP TABLE IF EXISTS "org_policies" CASCADE;
DROP TABLE IF EXISTS "org_provenance_metrics" CASCADE;
DROP TABLE IF EXISTS "organizations" CASCADE;
DROP TABLE IF EXISTS "performance_snapshots" CASCADE;
DROP TABLE IF EXISTS "pleading_templates" CASCADE;
DROP TABLE IF EXISTS "red_team_findings" CASCADE;
DROP TABLE IF EXISTS "regulator_dispatches" CASCADE;
DROP TABLE IF EXISTS "residency_zones" CASCADE;
DROP TABLE IF EXISTS "run_citations" CASCADE;
DROP TABLE IF EXISTS "run_retrieval_sets" CASCADE;
DROP TABLE IF EXISTS "slo_snapshots" CASCADE;
DROP TABLE IF EXISTS "source_identifiers" CASCADE;
DROP TABLE IF EXISTS "source_link_health" CASCADE;
DROP TABLE IF EXISTS "sources" CASCADE;
DROP TABLE IF EXISTS "sources_remote_metadata" CASCADE;
DROP TABLE IF EXISTS "synonym_tickets" CASCADE;
DROP TABLE IF EXISTS "tool_performance_metrics" CASCADE;
DROP TABLE IF EXISTS "transparency_reports" CASCADE;
DROP TABLE IF EXISTS "ui_telemetry" CASCADE;
DROP TABLE IF EXISTS "user_profiles" CASCADE;

-- Drop enum types
DROP TYPE IF EXISTS "Role" CASCADE;

-- Drop views
DROP VIEW IF EXISTS "cepej_metrics_view" CASCADE;
DROP VIEW IF EXISTS "identifier_coverage_view" CASCADE;
DROP VIEW IF EXISTS "org_jurisdiction_provenance_view" CASCADE;
DROP VIEW IF EXISTS "retrieval_metrics_views" CASCADE;

-- Note: This script removes ALL old tables
-- After running, use: npm run db:push

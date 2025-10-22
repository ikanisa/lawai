import { z } from 'zod';
import type { Database, Json } from './generated/database.types.js';

const jsonValueSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.union([jsonValueSchema, z.undefined()])),
  ]),
);

const isoTimestamp = z.string().min(1);

export const adminAuditEventSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  actor: z.string().min(1),
  action: z.string().min(1),
  object: z.string().min(1),
  payload_before: jsonValueSchema.nullable(),
  payload_after: jsonValueSchema.nullable(),
  created_at: isoTimestamp,
});

export const adminAgentSchema = z.object({
  id: z.string().min(1),
  org_id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  status: z.string().min(1),
  tool_count: z.number().int(),
  promoted_at: isoTimestamp,
});

export const adminCorpusSourceSchema = z.object({
  id: z.string().min(1),
  org_id: z.string().min(1),
  label: z.string().min(1),
  status: z.string().min(1),
  last_synced_at: isoTimestamp,
  quarantine_count: z.number().int(),
});

export const adminEntitlementSchema = z.object({
  org_id: z.string().min(1),
  jurisdiction: z.string().min(1),
  entitlement: z.string().min(1),
  enabled: z.boolean(),
  updated_at: isoTimestamp,
});

export const adminEvaluationSchema = z.object({
  id: z.string().min(1),
  org_id: z.string().min(1),
  name: z.string().min(1),
  pass_rate: z.string().min(1),
  slo_gate: z.string().min(1),
  status: z.string().min(1),
  last_run_at: isoTimestamp,
});

export const adminHitlQueueSchema = z.object({
  id: z.string().min(1),
  org_id: z.string().min(1),
  matter: z.string().min(1),
  summary: z.string().nullable(),
  status: z.string().min(1),
  blast_radius: z.number().int(),
  submitted_at: isoTimestamp,
});

export const adminIngestionTaskSchema = z.object({
  id: z.string().min(1),
  org_id: z.string().min(1),
  stage: z.string().min(1),
  status: z.string().min(1),
  progress: z.number().int(),
  last_error: z.string().nullable(),
  updated_at: isoTimestamp,
});

export const adminJobSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  type: z.string().min(1),
  status: z.string().min(1),
  progress: z.number().int(),
  last_error: z.string().nullable(),
  payload: jsonValueSchema.nullable(),
  actor: z.string().nullable(),
  updated_at: isoTimestamp,
});

export const adminPolicySchema = z.object({
  org_id: z.string().min(1),
  key: z.string().min(1),
  value: jsonValueSchema.nullable(),
  updated_at: isoTimestamp,
  updated_by: z.string().min(1),
});

export const adminTelemetrySnapshotSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  metric: z.string().min(1),
  value: z.string().nullable(),
  collected_at: isoTimestamp,
  tags: jsonValueSchema.nullable(),
});

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  org_id: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
  capabilities: z.array(z.string()),
  invited_at: isoTimestamp,
  last_active: isoTimestamp.nullable(),
});

export const adminWorkflowSchema = z.object({
  id: z.string().min(1),
  org_id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  status: z.string().min(1),
  draft_diff: jsonValueSchema.nullable(),
  updated_at: isoTimestamp,
  updated_by: z.string().nullable(),
});

export type AdminAuditEvent = Database['public']['Tables']['admin_audit_events']['Row'];
export type AdminAgent = Database['public']['Tables']['admin_agents']['Row'];
export type AdminCorpusSource = Database['public']['Tables']['admin_corpus_sources']['Row'];
export type AdminEntitlement = Database['public']['Tables']['admin_entitlements']['Row'];
export type AdminEvaluation = Database['public']['Tables']['admin_evaluations']['Row'];
export type AdminHitlQueueEntry = Database['public']['Tables']['admin_hitl_queue']['Row'];
export type AdminIngestionTask = Database['public']['Tables']['admin_ingestion_tasks']['Row'];
export type AdminJob = Database['public']['Tables']['admin_jobs']['Row'];
export type AdminPolicy = Database['public']['Tables']['admin_policies']['Row'];
export type AdminTelemetrySnapshot = Database['public']['Tables']['admin_telemetry_snapshots']['Row'];
export type AdminUser = Database['public']['Tables']['admin_users']['Row'];
export type AdminWorkflow = Database['public']['Tables']['admin_workflows']['Row'];

export const adminTables = {
  auditEvents: adminAuditEventSchema,
  agents: adminAgentSchema,
  corpusSources: adminCorpusSourceSchema,
  entitlements: adminEntitlementSchema,
  evaluations: adminEvaluationSchema,
  hitlQueue: adminHitlQueueSchema,
  ingestionTasks: adminIngestionTaskSchema,
  jobs: adminJobSchema,
  policies: adminPolicySchema,
  telemetrySnapshots: adminTelemetrySnapshotSchema,
  users: adminUserSchema,
  workflows: adminWorkflowSchema,
} satisfies Record<string, z.ZodTypeAny>;

export type AdminTableSchemas = typeof adminTables;

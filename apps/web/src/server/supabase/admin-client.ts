import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { serverEnv } from '../../env.server';

export interface PolicyRecord {
  key: string;
  value: string | number | boolean | null;
  updated_at: string;
  updated_by: string;
  org_id: string;
}

export interface EntitlementRecord {
  org_id: string;
  jurisdiction: string;
  entitlement: string;
  enabled: boolean;
  updated_at: string;
}

export interface JobRecord {
  id: string;
  type: string;
  status: string;
  progress: number;
  last_error: string | null;
  updated_at: string;
}

export interface AuditRecord {
  id: string;
  actor: string;
  action: string;
  object: string;
  payload_before: unknown;
  payload_after: unknown;
  created_at: string;
  org_id: string;
}

export interface UserRecord {
  id: string;
  org_id: string;
  email: string;
  role: string;
  capabilities: string[];
  last_active: string | null;
  invited_at: string;
}

export interface AgentRecord {
  id: string;
  org_id: string;
  name: string;
  version: string;
  status: string;
  tool_count: number;
  promoted_at: string;
}

export interface WorkflowRecord {
  id: string;
  org_id: string;
  name: string;
  version: string;
  status: string;
  updated_at: string;
  draft_diff: string;
}

export interface HitlRecord {
  id: string;
  org_id: string;
  matter: string;
  summary: string;
  submitted_at: string;
  status: string;
  blast_radius: number;
}

export interface CorpusSourceRecord {
  id: string;
  org_id: string;
  label: string;
  status: string;
  last_synced_at: string;
  quarantine_count: number;
}

export interface IngestionTaskRecord {
  id: string;
  org_id: string;
  stage: string;
  status: string;
  progress: number;
  updated_at: string;
  last_error: string | null;
}

export interface EvaluationRecord {
  id: string;
  org_id: string;
  name: string;
  pass_rate: number;
  slo_gate: string;
  last_run_at: string;
  status: string;
}

export interface TelemetrySnapshotRecord {
  id: string;
  org_id: string;
  metric: string;
  value: number;
  collected_at: string;
  tags: Record<string, unknown> | null;
}

interface FallbackStore {
  policies: Map<string, PolicyRecord[]>;
  entitlements: Map<string, EntitlementRecord[]>;
  jobs: Map<string, JobRecord[]>;
  audits: Map<string, AuditRecord[]>;
  users: Map<string, UserRecord[]>;
  agents: Map<string, AgentRecord[]>;
  workflows: Map<string, WorkflowRecord[]>;
  hitl: Map<string, HitlRecord[]>;
  corpus: Map<string, CorpusSourceRecord[]>;
  ingestion: Map<string, IngestionTaskRecord[]>;
  evaluations: Map<string, EvaluationRecord[]>;
  telemetry: Map<string, TelemetrySnapshotRecord[]>;
  seeded: Set<string>;
}

const FALLBACK_STORE: FallbackStore = {
  policies: new Map(),
  entitlements: new Map(),
  jobs: new Map(),
  audits: new Map(),
  users: new Map(),
  agents: new Map(),
  workflows: new Map(),
  hitl: new Map(),
  corpus: new Map(),
  ingestion: new Map(),
  evaluations: new Map(),
  telemetry: new Map(),
  seeded: new Set(),
};

let cachedClient: SupabaseClient | null = null;

function createAdminClient(): SupabaseClient | null {
  if (cachedClient) return cachedClient;
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceRole } = serverEnv;
  if (!url || !serviceRole) {
    return null;
  }
  cachedClient = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function seedFallbackOrg(orgId: string) {
  if (FALLBACK_STORE.seeded.has(orgId)) return;
  FALLBACK_STORE.seeded.add(orgId);

  const now = nowIso();

  FALLBACK_STORE.policies.set(orgId, [
    {
      key: 'feature:guardrails',
      value: true,
      updated_at: now,
      updated_by: 'dev-admin@local',
      org_id: orgId,
    },
    {
      key: 'residency:region',
      value: 'eu-west-1',
      updated_at: now,
      updated_by: 'dev-admin@local',
      org_id: orgId,
    },
  ]);

  FALLBACK_STORE.entitlements.set(orgId, [
    { org_id: orgId, jurisdiction: 'fr', entitlement: 'ingestion', enabled: true, updated_at: now },
    { org_id: orgId, jurisdiction: 'us', entitlement: 'hitl', enabled: true, updated_at: now },
  ]);

  FALLBACK_STORE.users.set(orgId, [
    {
      id: createId(),
      org_id: orgId,
      email: 'alex@demo.org',
      role: 'admin',
      capabilities: ['policies.manage', 'workflows.promote', 'hitl.review'],
      last_active: now,
      invited_at: now,
    },
    {
      id: createId(),
      org_id: orgId,
      email: 'casey@demo.org',
      role: 'reviewer',
      capabilities: ['hitl.review'],
      last_active: null,
      invited_at: now,
    },
  ]);

  FALLBACK_STORE.agents.set(orgId, [
    {
      id: 'agent-core',
      org_id: orgId,
      name: 'Core drafting agent',
      version: '2024.07.01',
      status: 'stable',
      tool_count: 6,
      promoted_at: now,
    },
    {
      id: 'agent-research',
      org_id: orgId,
      name: 'Research assistant',
      version: '2024.06.20',
      status: 'staging',
      tool_count: 4,
      promoted_at: now,
    },
  ]);

  FALLBACK_STORE.workflows.set(orgId, [
    {
      id: 'workflow-review',
      org_id: orgId,
      name: 'Matter review',
      version: 'v18',
      status: 'staging',
      updated_at: now,
      draft_diff: '{"summary":"Promote new summarizer"}',
    },
    {
      id: 'workflow-ingest',
      org_id: orgId,
      name: 'Ingestion pipeline',
      version: 'v11',
      status: 'production',
      updated_at: now,
      draft_diff: '{"summary":"Index additional folders"}',
    },
  ]);

  FALLBACK_STORE.hitl.set(orgId, [
    {
      id: 'hitl-1',
      org_id: orgId,
      matter: 'Matter-42',
      summary: 'Review summarisation for contract renewal',
      submitted_at: now,
      status: 'pending',
      blast_radius: 3,
    },
    {
      id: 'hitl-2',
      org_id: orgId,
      matter: 'Matter-17',
      summary: 'Check compliance redlines',
      submitted_at: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      status: 'pending',
      blast_radius: 1,
    },
  ]);

  FALLBACK_STORE.corpus.set(orgId, [
    {
      id: 'drive:contracts',
      org_id: orgId,
      label: 'Contracts drive',
      status: 'healthy',
      last_synced_at: now,
      quarantine_count: 0,
    },
    {
      id: 'drive:policies',
      org_id: orgId,
      label: 'Policies drive',
      status: 'warning',
      last_synced_at: now,
      quarantine_count: 2,
    },
  ]);

  FALLBACK_STORE.ingestion.set(orgId, [
    {
      id: 'ingest-1',
      org_id: orgId,
      stage: 'OCR',
      status: 'running',
      progress: 54,
      updated_at: now,
      last_error: null,
    },
    {
      id: 'ingest-2',
      org_id: orgId,
      stage: 'Vector store',
      status: 'queued',
      progress: 0,
      updated_at: now,
      last_error: null,
    },
  ]);

  FALLBACK_STORE.evaluations.set(orgId, [
    {
      id: 'dataset-citations',
      org_id: orgId,
      name: 'Citations fidelity',
      pass_rate: 0.96,
      slo_gate: '>= 0.93',
      last_run_at: now,
      status: 'pass',
    },
    {
      id: 'dataset-hallucinations',
      org_id: orgId,
      name: 'Hallucination guard',
      pass_rate: 0.89,
      slo_gate: '>= 0.92',
      last_run_at: now,
      status: 'fail',
    },
  ]);

  const telemetryPoints: TelemetrySnapshotRecord[] = [];
  for (let index = 0; index < 24; index += 1) {
    telemetryPoints.push({
      id: createId(),
      org_id: orgId,
      metric: 'runs_per_minute',
      value: 40 + Math.random() * 20,
      collected_at: new Date(Date.now() - index * 60 * 1000).toISOString(),
      tags: { window: '1h' },
    });
    telemetryPoints.push({
      id: createId(),
      org_id: orgId,
      metric: 'latency_p95_ms',
      value: 2600 + Math.random() * 400,
      collected_at: new Date(Date.now() - index * 60 * 1000).toISOString(),
      tags: { window: '1h' },
    });
  }
  FALLBACK_STORE.telemetry.set(orgId, telemetryPoints);
}

export async function listPolicies(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.policies.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<PolicyRecord>('admin_policies')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertPolicy(orgId: string, key: string, value: string | number | boolean) {
  const client = createAdminClient();
  const record: PolicyRecord = {
    key,
    value,
    updated_at: nowIso(),
    updated_by: 'admin',
    org_id: orgId,
  };
  if (!client) {
    seedFallbackOrg(orgId);
    const list = FALLBACK_STORE.policies.get(orgId) ?? [];
    const next = list.filter((item) => item.key !== key);
    next.unshift(record);
    FALLBACK_STORE.policies.set(orgId, next);
    return record;
  }
  const { data, error } = await client
    .from<PolicyRecord>('admin_policies')
    .upsert({
      org_id: orgId,
      key,
      value,
      updated_at: record.updated_at,
      updated_by: record.updated_by,
    })
    .select()
    .single();
  if (error) throw error;
  return data ?? record;
}

export async function listEntitlements(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.entitlements.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<EntitlementRecord>('admin_entitlements')
    .select('*')
    .eq('org_id', orgId)
    .order('jurisdiction', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function upsertEntitlement(orgId: string, jurisdiction: string, entitlement: string, enabled: boolean) {
  const client = createAdminClient();
  const record: EntitlementRecord = {
    org_id: orgId,
    jurisdiction,
    entitlement,
    enabled,
    updated_at: nowIso(),
  };
  if (!client) {
    seedFallbackOrg(orgId);
    const list = FALLBACK_STORE.entitlements.get(orgId) ?? [];
    const remaining = list.filter(
      (item) => item.jurisdiction !== jurisdiction || item.entitlement !== entitlement,
    );
    remaining.push(record);
    FALLBACK_STORE.entitlements.set(orgId, remaining);
    return record;
  }
  const { data, error } = await client
    .from<EntitlementRecord>('admin_entitlements')
    .upsert(record)
    .select()
    .single();
  if (error) throw error;
  return data ?? record;
}

export async function appendAuditEvent(event: Omit<AuditRecord, 'id' | 'created_at'>) {
  const client = createAdminClient();
  const record: AuditRecord = {
    id: createId(),
    created_at: nowIso(),
    ...event,
  };
  if (!client) {
    seedFallbackOrg(event.org_id);
    const list = FALLBACK_STORE.audits.get(event.org_id) ?? [];
    list.unshift(record);
    FALLBACK_STORE.audits.set(event.org_id, list);
    return record;
  }
  const { data, error } = await client
    .from<AuditRecord>('admin_audit_events')
    .insert({
      org_id: event.org_id,
      actor: event.actor,
      action: event.action,
      object: event.object,
      payload_before: event.payload_before,
      payload_after: event.payload_after,
    })
    .select()
    .single();
  if (error) throw error;
  return data ?? record;
}

export async function listAuditEvents(orgId: string, limit = 100) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return (FALLBACK_STORE.audits.get(orgId) ?? []).slice(0, limit);
  }
  const { data, error } = await client
    .from<AuditRecord>('admin_audit_events')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function listJobs(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.jobs.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<JobRecord>('admin_jobs')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function enqueueJob(orgId: string, type: string, actor: string, payload?: Record<string, unknown>) {
  const client = createAdminClient();
  const record: JobRecord = {
    id: createId(),
    type,
    status: 'queued',
    progress: 0,
    last_error: null,
    updated_at: nowIso(),
  };
  if (!client) {
    seedFallbackOrg(orgId);
    const list = FALLBACK_STORE.jobs.get(orgId) ?? [];
    list.unshift(record);
    FALLBACK_STORE.jobs.set(orgId, list);
    return record;
  }
  const { data, error } = await client
    .from<JobRecord>('admin_jobs')
    .insert({
      id: record.id,
      org_id: orgId,
      type,
      status: record.status,
      progress: record.progress,
      last_error: record.last_error,
      payload,
      actor,
    })
    .select()
    .single();
  if (error) throw error;
  return data ?? record;
}

export async function listUsers(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.users.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<UserRecord>('admin_users')
    .select('*')
    .eq('org_id', orgId)
    .order('invited_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function inviteUser(orgId: string, email: string, role: string) {
  const client = createAdminClient();
  const record: UserRecord = {
    id: createId(),
    org_id: orgId,
    email,
    role,
    capabilities: role === 'admin' ? ['*'] : ['hitl.review'],
    last_active: null,
    invited_at: nowIso(),
  };
  if (!client) {
    seedFallbackOrg(orgId);
    const list = FALLBACK_STORE.users.get(orgId) ?? [];
    FALLBACK_STORE.users.set(orgId, [record, ...list]);
    return record;
  }
  const { data, error } = await client
    .from<UserRecord>('admin_users')
    .insert({
      id: record.id,
      org_id: orgId,
      email,
      role,
      capabilities: record.capabilities,
      invited_at: record.invited_at,
      last_active: record.last_active,
    })
    .select()
    .single();
  if (error) throw error;
  return data ?? record;
}

export async function updateUser(orgId: string, userId: string, updates: Partial<UserRecord>) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    const list = FALLBACK_STORE.users.get(orgId) ?? [];
    const next = list.map((user) => (user.id === userId ? { ...user, ...updates } : user));
    FALLBACK_STORE.users.set(orgId, next);
    return next.find((user) => user.id === userId) ?? null;
  }
  const { data, error } = await client
    .from<UserRecord>('admin_users')
    .update(updates)
    .eq('org_id', orgId)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listAgents(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.agents.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<AgentRecord>('admin_agents')
    .select('*')
    .eq('org_id', orgId)
    .order('promoted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listWorkflows(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.workflows.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<WorkflowRecord>('admin_workflows')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateWorkflowStatus(orgId: string, workflowId: string, status: string, actor: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    const list = FALLBACK_STORE.workflows.get(orgId) ?? [];
    const next = list.map((workflow) =>
      workflow.id === workflowId ? { ...workflow, status, updated_at: nowIso() } : workflow,
    );
    FALLBACK_STORE.workflows.set(orgId, next);
    return next.find((workflow) => workflow.id === workflowId) ?? null;
  }
  const { data, error } = await client
    .from<WorkflowRecord>('admin_workflows')
    .update({ status, updated_at: nowIso(), updated_by: actor })
    .eq('org_id', orgId)
    .eq('id', workflowId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listHitlItems(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.hitl.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<HitlRecord>('admin_hitl_queue')
    .select('*')
    .eq('org_id', orgId)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateHitlItem(orgId: string, itemId: string, status: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    const list = FALLBACK_STORE.hitl.get(orgId) ?? [];
    const next = list.map((item) => (item.id === itemId ? { ...item, status } : item));
    FALLBACK_STORE.hitl.set(orgId, next);
    return next.find((item) => item.id === itemId) ?? null;
  }
  const { data, error } = await client
    .from<HitlRecord>('admin_hitl_queue')
    .update({ status })
    .eq('org_id', orgId)
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listCorpusSources(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.corpus.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<CorpusSourceRecord>('admin_corpus_sources')
    .select('*')
    .eq('org_id', orgId)
    .order('label');
  if (error) throw error;
  return data ?? [];
}

export async function listIngestionTasks(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.ingestion.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<IngestionTaskRecord>('admin_ingestion_tasks')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listEvaluations(orgId: string) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    return FALLBACK_STORE.evaluations.get(orgId) ?? [];
  }
  const { data, error } = await client
    .from<EvaluationRecord>('admin_evaluations')
    .select('*')
    .eq('org_id', orgId)
    .order('last_run_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listTelemetrySnapshots(orgId: string, limit = 50) {
  const client = createAdminClient();
  if (!client) {
    seedFallbackOrg(orgId);
    const snapshots = FALLBACK_STORE.telemetry.get(orgId) ?? [];
    return snapshots.slice(0, limit);
  }
  const { data, error } = await client
    .from<TelemetrySnapshotRecord>('admin_telemetry_snapshots')
    .select('*')
    .eq('org_id', orgId)
    .order('collected_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

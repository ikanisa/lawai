'use client';

import { queryOptions } from '@tanstack/react-query';
import { toast } from 'sonner';

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  orgId?: string;
  actorId?: string;
}

interface AdminApiResponse<T> {
  data: T;
}

type SessionAccessor = () => { actorId: string | null; orgId: string | null } | null;

let adminSessionAccessor: SessionAccessor | null = null;

export function setAdminSessionAccessor(accessor: SessionAccessor) {
  adminSessionAccessor = accessor;
}

function resolveSessionIdentifiers(options: FetchOptions): { actorId: string; orgId: string } {
  const session = adminSessionAccessor?.() ?? null;

  const actorId = options.actorId ?? session?.actorId ?? null;
  let orgId = options.orgId ?? null;

  if (!orgId && options.query && 'orgId' in options.query) {
    const value = options.query.orgId;
    if (value !== undefined) {
      orgId = String(value);
    }
  }

  if (!orgId) {
    orgId = session?.orgId ?? null;
  }

  if (!actorId) {
    throw new Error('Admin session is missing the actor identifier');
  }

  if (!orgId) {
    throw new Error('Admin session is missing the organization identifier');
  }

  return { actorId, orgId };
}

async function fetchAdminApi<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = options;
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(`/api/admin/${path}`, origin);
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const { actorId, orgId } = resolveSessionIdentifiers(options);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-admin-actor': actorId,
    'x-admin-org': orgId,
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    credentials: 'include',
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const message = await response.text();
    toast.error(message || 'Une erreur est survenue');
    throw new Error(message || 'Failed to fetch admin API');
  }

  const payload = (await response.json()) as AdminApiResponse<T>;
  return payload.data;
}

export const adminQueryKeys = {
  overview: (orgId: string) => ['admin', 'overview', orgId] as const,
  people: (orgId: string) => ['admin', 'people', orgId] as const,
  policies: (orgId: string) => ['admin', 'policies', orgId] as const,
  jurisdictions: (orgId: string) => ['admin', 'jurisdictions', orgId] as const,
  agents: (orgId: string) => ['admin', 'agents', orgId] as const,
  workflows: (orgId: string) => ['admin', 'workflows', orgId] as const,
  hitl: (orgId: string) => ['admin', 'hitl', orgId] as const,
  corpus: (orgId: string) => ['admin', 'corpus', orgId] as const,
  ingestion: (orgId: string) => ['admin', 'ingestion', orgId] as const,
  evaluations: (orgId: string) => ['admin', 'evaluations', orgId] as const,
  telemetry: (orgId: string) => ['admin', 'telemetry', orgId] as const,
  audit: (orgId: string) => ['admin', 'audit', orgId] as const,
  billing: (orgId: string) => ['admin', 'billing', orgId] as const,
  jobs: (orgId: string) => ['admin', 'jobs', orgId] as const,
};

export const adminQueries = {
  overview: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.overview(orgId),
      queryFn: () => fetchAdminApi<OverviewResponse>('overview', { query: { orgId }, orgId }),
    }),
  people: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.people(orgId),
      queryFn: () => fetchAdminApi<PeopleResponse>('people', { query: { orgId }, orgId }),
    }),
  policies: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.policies(orgId),
      queryFn: () => fetchAdminApi<PolicyResponse>('policies', { query: { orgId }, orgId }),
    }),
  jurisdictions: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.jurisdictions(orgId),
      queryFn: () => fetchAdminApi<JurisdictionResponse>('jurisdictions', { query: { orgId }, orgId }),
    }),
  agents: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.agents(orgId),
      queryFn: () => fetchAdminApi<AgentResponse>('agents', { query: { orgId }, orgId }),
    }),
  workflows: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.workflows(orgId),
      queryFn: () => fetchAdminApi<WorkflowResponse>('workflows', { query: { orgId }, orgId }),
    }),
  hitl: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.hitl(orgId),
      queryFn: () => fetchAdminApi<HitlResponse>('hitl', { query: { orgId }, orgId }),
    }),
  corpus: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.corpus(orgId),
      queryFn: () => fetchAdminApi<CorpusResponse>('corpus', { query: { orgId }, orgId }),
    }),
  ingestion: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.ingestion(orgId),
      queryFn: () => fetchAdminApi<IngestionResponse>('ingestion', { query: { orgId }, orgId }),
    }),
  evaluations: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.evaluations(orgId),
      queryFn: () => fetchAdminApi<EvaluationResponse>('evaluations', { query: { orgId }, orgId }),
    }),
  telemetry: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.telemetry(orgId),
      queryFn: () => fetchAdminApi<TelemetryResponse>('telemetry', { query: { orgId }, orgId }),
    }),
  audit: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.audit(orgId),
      queryFn: () => fetchAdminApi<AuditResponse>('audit-log', { query: { orgId }, orgId }),
    }),
  billing: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.billing(orgId),
      queryFn: () => fetchAdminApi<BillingResponse>('billing', { query: { orgId }, orgId }),
    }),
  jobs: (orgId: string) =>
    queryOptions({
      queryKey: adminQueryKeys.jobs(orgId),
      queryFn: () => fetchAdminApi<JobListResponse>('jobs', { query: { orgId }, orgId }),
      refetchInterval: 5000,
    }),
};

export type OverviewResponse = {
  stats: Array<{
    id: string;
    label: string;
    value: number;
    trend: number;
    unit?: string;
  }>;
  charts: Array<{
    id: string;
    title: string;
    points: Array<{ x: string; y: number }>;
  }>;
  alerts: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    summary: string;
    cta?: string;
  }>;
};

export interface PeopleResponse {
  users: Array<{
    id: string;
    email: string;
    role: string;
    capabilities: string[];
    invitedAt: string;
    lastActive: string | null;
  }>;
}

export interface PolicyResponse {
  policies: Array<{
    key: string;
    value: boolean | string | number;
    updatedAt: string;
    updatedBy: string;
  }>;
}

export interface JurisdictionResponse {
  entitlements: Array<{
    jurisdiction: string;
    entitlement: string;
    enabled: boolean;
    updatedAt: string;
  }>;
}

export interface JobListResponse {
  jobs: Array<{
    id: string;
    type: string;
    status: string;
    progress: number;
    lastError?: string | null;
    updatedAt: string;
  }>;
}

export interface AgentResponse {
  agents: Array<{
    id: string;
    name: string;
    version: string;
    toolCount: number;
    status: string;
    promotedAt: string;
  }>;
}

export interface WorkflowResponse {
  workflows: Array<{
    id: string;
    name: string;
    version: string;
    status: string;
    updatedAt: string;
    diff?: string;
  }>;
}

export interface HitlResponse {
  queue: Array<{
    id: string;
    matter: string;
    summary: string;
    submittedAt: string;
    status: string;
    blastRadius: number;
  }>;
}

export interface CorpusResponse {
  sources: Array<{
    id: string;
    status: string;
    lastSyncedAt: string;
    quarantineCount: number;
  }>;
}

export interface IngestionResponse {
  tasks: Array<{
    id: string;
    stage: string;
    status: string;
    progress: number;
    updatedAt: string;
    lastError?: string;
  }>;
}

export interface EvaluationResponse {
  evaluations: Array<{
    id: string;
    name: string;
    passRate: number;
    sloGate: string;
    lastRunAt: string;
    status: 'pass' | 'fail';
  }>;
}

export interface TelemetryResponse {
  metrics: Array<{
    metric: string;
    value: string;
    delta: string;
    window: string;
  }>;
  charts: Array<{
    id: string;
    title: string;
    points: Array<{ x: number | string; y: number }>;
  }>;
}

export interface AuditResponse {
  events: Array<{
    id: string;
    actor: string;
    action: string;
    object: string;
    createdAt: string;
  }>;
}

export interface BillingResponse {
  usage: Array<{
    id: string;
    label: string;
    quantity: number;
    cost: string;
  }>;
}

export async function triggerAdminJob(type: string, orgId: string, payload?: Record<string, unknown>) {
  await fetchAdminApi<JobListResponse>('jobs', {
    method: 'POST',
    body: { type, orgId, payload },
    orgId,
  });
}

export async function inviteAdminUser(orgId: string, payload: { email: string; role: string }) {
  await fetchAdminApi<PeopleResponse>('people', {
    method: 'POST',
    body: { action: 'invite', payload },
    orgId,
  });
}

export async function updateAdminUser(
  orgId: string,
  payload: { id: string; role: string; capabilities: string[] },
) {
  await fetchAdminApi<PeopleResponse>('people', {
    method: 'PATCH',
    body: { action: 'update', payload },
    orgId,
  });
}

export async function toggleJurisdictionEntitlement(
  orgId: string,
  payload: { jurisdiction: string; entitlement: string; enabled: boolean },
) {
  await fetchAdminApi<JurisdictionResponse>('jurisdictions', {
    method: 'POST',
    body: { action: 'toggle', payload },
    orgId,
  });
}

export async function recordHitlDecision(
  orgId: string,
  payload: { id: string; action: 'approved' | 'revision-requested' | 'rejected' },
) {
  await fetchAdminApi<HitlResponse>('hitl', {
    method: 'POST',
    body: { action: 'decision', payload },
    orgId,
  });
}

export async function updateWorkflowStatus(
  orgId: string,
  action: 'promote' | 'rollback',
  workflowId: string,
) {
  await fetchAdminApi<WorkflowResponse>('workflows', {
    method: 'POST',
    body: { action, payload: { workflowId } },
    orgId,
  });
}

export async function upsertAdminPolicy(orgId: string, payload: { key: string; value: unknown }) {
  await fetchAdminApi<PolicyResponse>('policies', {
    method: 'POST',
    body: { action: 'upsert', payload },
    orgId,
  });
}

export async function controlIngestion(orgId: string, action: 'start' | 'stop' | 'backfill') {
  await fetchAdminApi<IngestionResponse>('ingestion', {
    method: 'POST',
    body: { action },
    orgId,
  });
}

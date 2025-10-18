import {
  appendAuditEvent,
  enqueueJob,
  listAgents,
  listAuditEvents,
  listCorpusSources,
  listEntitlements,
  listEvaluations,
  listHitlItems,
  listIngestionTasks,
  listJobs,
  listPolicies,
  listTelemetrySnapshots,
  listUsers,
  listWorkflows,
  updateHitlItem,
  updateUser,
  updateWorkflowStatus,
  inviteUser,
  upsertEntitlement,
  upsertPolicy,
} from '../supabase/admin-client';
import type {
  AgentResponse,
  AuditResponse,
  BillingResponse,
  CorpusResponse,
  EvaluationResponse,
  HitlResponse,
  IngestionResponse,
  JobListResponse,
  JurisdictionResponse,
  OverviewResponse,
  PeopleResponse,
  PolicyResponse,
  TelemetryResponse,
  WorkflowResponse,
} from '../../features/admin-panel/api/client';

function calculateTrend(current: number, previous: number) {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

export async function getOverview(orgId: string): Promise<OverviewResponse> {
  const [evaluations, ingestion, jobs, telemetrySnapshots] = await Promise.all([
    listEvaluations(orgId),
    listIngestionTasks(orgId),
    listJobs(orgId),
    listTelemetrySnapshots(orgId, 48),
  ]);

  const passRates = evaluations.map((evaluation) => evaluation.pass_rate);
  const averagePass = passRates.length
    ? Math.round((passRates.reduce((sum, value) => sum + value, 0) / passRates.length) * 100) / 100
    : 0;
  const previousSlice = passRates.length > 1 ? passRates.slice(Math.floor(passRates.length / 2)) : [];
  const previousPass = previousSlice.length
    ? previousSlice.reduce((sum, value) => sum + value, 0) / previousSlice.length
    : averagePass;

  const latestIngestionUpdate = ingestion
    .map((task) => new Date(task.updated_at).getTime())
    .sort((a, b) => b - a)[0];
  const freshnessHours = latestIngestionUpdate
    ? Math.max(0, Math.round((Date.now() - latestIngestionUpdate) / (1000 * 60 * 60)))
    : 0;

  const charts = ['runs_per_minute', 'latency_p95_ms'].map((metric) => {
    const series = telemetrySnapshots.filter((snapshot) => snapshot.metric === metric);
    return {
      id: metric,
      title: metric === 'runs_per_minute' ? 'Runs per minute' : 'Latency p95 (ms)',
      points: series
        .slice()
        .reverse()
        .map((snapshot, index) => ({ x: index, y: Math.round(snapshot.value) })),
    };
  });

  const alerts = [] as OverviewResponse['alerts'];
  const failedEval = evaluations.find((evaluation) => evaluation.status === 'fail');
  if (failedEval) {
    alerts.push({
      id: `eval-${failedEval.id}`,
      severity: 'critical',
      summary: `${failedEval.name} below SLO (${Math.round(failedEval.pass_rate * 100)}% vs ${failedEval.slo_gate})`,
      cta: 'Open evaluations',
    });
  }
  const stalledJob = jobs.find((job) => job.status !== 'completed' && job.progress < 50);
  if (stalledJob) {
    alerts.push({
      id: `job-${stalledJob.id}`,
      severity: 'warning',
      summary: `${stalledJob.type} is ${stalledJob.status} (${stalledJob.progress}% complete)`,
      cta: 'View jobs',
    });
  }

  return {
    stats: [
      {
        id: 'runs',
        label: 'Agent runs (24h)',
        value: Math.round(
          telemetrySnapshots.filter((point) => point.metric === 'runs_per_minute').reduce((sum, item) => sum + item.value, 0),
        ),
        trend: calculateTrend(
          telemetrySnapshots
            .filter((point) => point.metric === 'runs_per_minute')
            .slice(0, 12)
            .reduce((sum, item) => sum + item.value, 0),
          telemetrySnapshots
            .filter((point) => point.metric === 'runs_per_minute')
            .slice(12, 24)
            .reduce((sum, item) => sum + item.value, 0) || 1,
        ),
      },
      {
        id: 'evals',
        label: 'Evals pass rate',
        value: Math.round(averagePass * 100) / 100,
        trend: calculateTrend(averagePass, previousPass || averagePass),
        unit: '%',
      },
      {
        id: 'ingestion',
        label: 'Ingestion freshness',
        value: freshnessHours,
        trend: freshnessHours > 4 ? -12 : 8,
        unit: 'h',
      },
      {
        id: 'sla',
        label: 'SLO compliance',
        value: Math.max(90, Math.round(averagePass * 100)),
        trend: 4,
        unit: '%',
      },
    ],
    charts,
    alerts,
  };
}

export async function getPeople(orgId: string): Promise<PeopleResponse> {
  const users = await listUsers(orgId);
  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      capabilities: user.capabilities,
      invitedAt: user.invited_at,
      lastActive: user.last_active,
    })),
  };
}

export async function invitePerson(orgId: string, email: string, role: string, actor: string) {
  const record = await inviteUser(orgId, email, role);
  await appendAuditEvent({
    org_id: orgId,
    actor,
    action: 'people.invite',
    object: record.id,
    payload_before: null,
    payload_after: record,
  });
  return record;
}

export async function updatePerson(orgId: string, userId: string, updates: { role: string; capabilities: string[] }, actor: string) {
  const record = await updateUser(orgId, userId, updates);
  await appendAuditEvent({
    org_id: orgId,
    actor,
    action: 'people.update',
    object: userId,
    payload_before: null,
    payload_after: record,
  });
  return record;
}

export async function getPolicies(orgId: string): Promise<PolicyResponse> {
  const records = await listPolicies(orgId);
  return {
    policies: records.map((policy) => ({
      key: policy.key,
      value: policy.value ?? false,
      updatedAt: policy.updated_at,
      updatedBy: policy.updated_by,
    })),
  };
}

export async function savePolicy(orgId: string, key: string, value: string | number | boolean, actor: string) {
  const before = await getPolicies(orgId);
  const record = await upsertPolicy(orgId, key, value);
  await appendAuditEvent({
    org_id: orgId,
    actor,
    action: 'policy.upsert',
    object: key,
    payload_before: before,
    payload_after: record,
  });
  return record;
}

export async function getJurisdictions(orgId: string): Promise<JurisdictionResponse> {
  const records = await listEntitlements(orgId);
  return {
    entitlements: records.map((entry) => ({
      jurisdiction: entry.jurisdiction,
      entitlement: entry.entitlement,
      enabled: entry.enabled,
      updatedAt: entry.updated_at,
    })),
  };
}

export async function saveEntitlement(
  orgId: string,
  jurisdiction: string,
  entitlement: string,
  enabled: boolean,
  actor: string,
) {
  const before = await getJurisdictions(orgId);
  const record = await upsertEntitlement(orgId, jurisdiction, entitlement, enabled);
  await appendAuditEvent({
    org_id: orgId,
    actor,
    action: 'entitlement.toggle',
    object: `${jurisdiction}:${entitlement}`,
    payload_before: before,
    payload_after: record,
  });
  return record;
}

export async function getAgents(orgId: string): Promise<AgentResponse> {
  const agents = await listAgents(orgId);
  return {
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      version: agent.version,
      toolCount: agent.tool_count,
      status: agent.status,
      promotedAt: agent.promoted_at,
    })),
  };
}

export async function getWorkflows(orgId: string): Promise<WorkflowResponse> {
  const workflows = await listWorkflows(orgId);
  return {
    workflows: workflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      status: workflow.status,
      updatedAt: workflow.updated_at,
      diff: workflow.draft_diff,
    })),
  };
}

export async function promoteWorkflow(orgId: string, workflowId: string, actor: string) {
  const record = await updateWorkflowStatus(orgId, workflowId, 'production', actor);
  await appendAuditEvent({
    org_id: orgId,
    actor,
    action: 'workflow.promote',
    object: workflowId,
    payload_before: null,
    payload_after: record,
  });
  return record;
}

export async function rollbackWorkflow(orgId: string, workflowId: string, actor: string) {
  const record = await updateWorkflowStatus(orgId, workflowId, 'staging', actor);
  await appendAuditEvent({
    org_id: orgId,
    actor,
    action: 'workflow.rollback',
    object: workflowId,
    payload_before: null,
    payload_after: record,
  });
  return record;
}

export async function getHitlQueue(orgId: string): Promise<HitlResponse> {
  const queue = await listHitlItems(orgId);
  return {
    queue: queue.map((item) => ({
      id: item.id,
      matter: item.matter,
      summary: item.summary,
      submittedAt: item.submitted_at,
      status: item.status,
      blastRadius: item.blast_radius,
    })),
  };
}

export async function recordHitlDecision(orgId: string, itemId: string, action: string, actor: string) {
  const record = await updateHitlItem(orgId, itemId, action);
  await appendAuditEvent({
    org_id: orgId,
    actor,
    action: `hitl.${action}`,
    object: itemId,
    payload_before: null,
    payload_after: record,
  });
}

export async function getCorpus(orgId: string): Promise<CorpusResponse> {
  const sources = await listCorpusSources(orgId);
  return {
    sources: sources.map((source) => ({
      id: source.id,
      label: source.label,
      status: source.status,
      lastSyncedAt: source.last_synced_at,
      quarantineCount: source.quarantine_count,
    })),
  };
}

export async function getIngestion(orgId: string): Promise<IngestionResponse> {
  const tasks = await listIngestionTasks(orgId);
  return {
    tasks: tasks.map((task) => ({
      id: task.id,
      stage: task.stage,
      status: task.status,
      progress: task.progress,
      updatedAt: task.updated_at,
      lastError: task.last_error ?? undefined,
    })),
  };
}

export async function getEvaluations(orgId: string): Promise<EvaluationResponse> {
  const evaluations = await listEvaluations(orgId);
  return {
    evaluations: evaluations.map((evaluation) => ({
      id: evaluation.id,
      name: evaluation.name,
      passRate: Math.round(evaluation.pass_rate * 10000) / 100,
      sloGate: evaluation.slo_gate,
      lastRunAt: evaluation.last_run_at,
      status: evaluation.status === 'fail' ? 'fail' : 'pass',
    })),
  };
}

export async function getTelemetry(orgId: string): Promise<TelemetryResponse> {
  const snapshots = await listTelemetrySnapshots(orgId, 60);
  const runs = snapshots.filter((snapshot) => snapshot.metric === 'runs_per_minute');
  const latency = snapshots.filter((snapshot) => snapshot.metric === 'latency_p95_ms');

  return {
    metrics: [
      {
        metric: 'Agent latency p95',
        value: `${Math.round(latency[0]?.value ?? 0)}ms`,
        delta: `${calculateTrend(latency[0]?.value ?? 0, latency[latency.length - 1]?.value ?? 1)}%`,
        window: '1h',
      },
      {
        metric: 'Runs per minute',
        value: Math.round(runs[0]?.value ?? 0).toString(),
        delta: `${calculateTrend(runs[0]?.value ?? 0, runs[runs.length - 1]?.value ?? 1)}%`,
        window: '1h',
      },
    ],
    charts: [
      {
        id: 'runs',
        title: 'Runs per minute',
        points: runs.slice().reverse().map((snapshot, index) => ({ x: index, y: Math.round(snapshot.value) })),
      },
      {
        id: 'latency',
        title: 'Latency p95 (ms)',
        points: latency.slice().reverse().map((snapshot, index) => ({ x: index, y: Math.round(snapshot.value) })),
      },
    ],
  };
}

export async function getAudit(orgId: string): Promise<AuditResponse> {
  const events = await listAuditEvents(orgId, 200);
  return {
    events: events.map((event) => ({
      id: event.id,
      actor: event.actor,
      action: event.action,
      object: event.object,
      createdAt: event.created_at,
    })),
  };
}

export async function getJobs(orgId: string): Promise<JobListResponse> {
  const jobs = await listJobs(orgId);
  return {
    jobs: jobs.map((job) => ({
      id: job.id,
      type: job.type,
      status: job.status,
      progress: job.progress,
      lastError: job.last_error,
      updatedAt: job.updated_at,
    })),
  };
}

export async function queueJob(orgId: string, type: string, actor: string, payload?: Record<string, unknown>) {
  await enqueueJob(orgId, type, actor, payload);
}

export async function getBilling(orgId: string): Promise<BillingResponse> {
  const [jobs, evaluations] = await Promise.all([listJobs(orgId), listEvaluations(orgId)]);
  const jobRuns = jobs.length * 120;
  const evaluationCost = evaluations.length * 42;
  return {
    usage: [
      { id: 'runs', label: 'Agent runs', quantity: jobRuns, cost: `€${(jobRuns * 0.04).toFixed(2)}` },
      { id: 'evaluations', label: 'Evaluations', quantity: evaluations.length, cost: `€${evaluationCost.toFixed(2)}` },
      { id: 'storage', label: 'Storage (GB)', quantity: 82, cost: '€49.20' },
    ],
  };
}

import {
  Agent,
  OpenAIProvider,
  run as runAgent,
  setDefaultModelProvider,
  setDefaultOpenAIKey,
  setOpenAIAPI,
} from '@openai/agents';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ConnectorStatus,
  ConnectorType,
  DirectorCommandInput,
  FinanceDirectorPlan,
  FinanceDirectorPlanSchema,
  FinanceSafetyReview,
  FinanceSafetyReviewSchema,
  OrchestratorCommandEnvelope,
  OrchestratorCommandRecord,
  OrchestratorCommandResponse,
  OrchestratorJobRecord,
  OrchestratorSessionRecord,
  OrgConnectorRecord,
  SafetyAssessmentResult,
} from '@avocat-ai/shared';
import { env } from './config.js';
import { getOpenAI, logOpenAIDebug } from './openai.js';

export interface OrchestratorLogger {
  error: (data: Record<string, unknown>, message: string) => void;
  warn?: (data: Record<string, unknown>, message: string) => void;
  info?: (data: Record<string, unknown>, message: string) => void;
}

export interface RegisterConnectorInput {
  orgId: string;
  connectorType: ConnectorType;
  name: string;
  config?: Record<string, unknown>;
  status?: ConnectorStatus;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface UpdateSessionStateInput {
  sessionId: string;
  directorState?: FinanceDirectorPlan | null;
  safetyState?: FinanceSafetyReview | null;
  metadata?: Record<string, unknown>;
  currentObjective?: string | null;
  status?: OrchestratorSessionRecord['status'];
  lastDirectorRunId?: string | null;
  lastSafetyRunId?: string | null;
}

const DIRECTOR_INSTRUCTIONS = `Tu es "Le Directeur", l'orchestrateur MCP des agents financiers (taxe, audit, AP, CFO, risque, conformité).

Ta mission:
1. Analyser l'objectif métier et le contexte conversationnel (session ChatKit + Supabase).
2. Planifier des étapes explicites avec agents délégués, budgets outils, critères de succès et garde-fous HITL.
3. S'appuyer sur l'état persistant (Supabase) pour mémoriser décisions, blockers et métadonnées.
4. Déléguer aux agents de domaine via des commandes structurées, en respectant les politiques résidence/confidentialité.
5. Synchroniser les connecteurs (ERP, fiscalité, compta) avant de déclencher une action qui en dépend.
6. Toujours informer la Safety Agent si la tâche implique un risque élevé, une divulgation réglementaire ou un écart de politique.

Contraintes:
- Pas de chaîne de pensée: retourne uniquement plans structurés, commandes ou résumés homologables.
- Si l'objectif te semble ambigu, créer une commande "clarify" pour l'utilisateur humain.
- Pour chaque commande, indique le worker cible (domain|director|safety), priorité, détection HITL, dépendances.
- Ne jamais ignorer les signaux de politique Supabase (ban analytique juge, confidentialité, résidence).
`;

const SAFETY_INSTRUCTIONS = `Tu es "Safety", garante de la conformité et des politiques de sécurité:
- Vérifie chaque commande/directive reçue du Directeur.
- Signale les anomalies (confidentialité, résidence, guardrails, obligations réglementaires) et propose des mitigations.
- Peut basculer une commande en HITL ou refuser l'exécution.
- Maintient un journal Supabase des contrôles effectués.
`;

let providerConfigured = false;
let directorAgentInstance: Agent | null = null;
let safetyAgentInstance: Agent | null = null;

const MAX_STEP_TOOL_BUDGET_TOKENS = 32;
const MAX_PLAN_TOOL_BUDGET_TOKENS = 128;

async function drainAgentStream(response: unknown, logger?: OrchestratorLogger): Promise<void> {
  if (!response || typeof response !== 'object') {
    return;
  }

  const candidate =
    (response as Record<string, unknown>).stream ??
    (response as Record<string, unknown>).eventStream ??
    (response as Record<string, unknown>).events ??
    null;

  if (!candidate || typeof candidate !== 'object' || typeof (candidate as any)[Symbol.asyncIterator] !== 'function') {
    return;
  }

  const iterable = candidate as AsyncIterable<unknown>;

  try {
    for await (const _event of iterable) {
      // Consume the iterator to avoid leaking open handles from streaming responses
    }
  } catch (error) {
    logger?.warn?.(
      { err: error instanceof Error ? error.message : error },
      'director_plan_stream_drain_failed',
    );
  }
}

function ensureDirectorPlanBudget(plan: FinanceDirectorPlan, logger?: OrchestratorLogger): void {
  let totalTokens = 0;

  for (const step of plan.steps ?? []) {
    const tokens = step.envelope?.budget?.tokens;
    if (typeof tokens === 'number') {
      if (tokens > MAX_STEP_TOOL_BUDGET_TOKENS) {
        logger?.warn?.(
          { stepId: step.id, tokens, limit: MAX_STEP_TOOL_BUDGET_TOKENS },
          'director_plan_budget_exceeded',
        );
        throw new Error('director_plan_budget_exceeded');
      }
      totalTokens += tokens;
    }
  }

  if (totalTokens > MAX_PLAN_TOOL_BUDGET_TOKENS) {
    logger?.warn?.(
      { totalTokens, limit: MAX_PLAN_TOOL_BUDGET_TOKENS },
      'director_plan_budget_total_exceeded',
    );
    throw new Error('director_plan_budget_total_exceeded');
  }
}

function ensureOpenAIProvider(): void {
  if (providerConfigured) {
    return;
  }
  setDefaultOpenAIKey(env.OPENAI_API_KEY);
  setOpenAIAPI('responses');
  setDefaultModelProvider(
    new OpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      useResponses: true,
    }),
  );
  providerConfigured = true;
}

function createDirectorAgent(): Agent {
  ensureOpenAIProvider();
  return new Agent({
    name: 'finance-director',
    instructions: DIRECTOR_INSTRUCTIONS,
    model: env.AGENT_MODEL,
    outputType: FinanceDirectorPlanSchema,
  });
}

function createSafetyAgent(): Agent {
  ensureOpenAIProvider();
  return new Agent({
    name: 'finance-safety',
    instructions: SAFETY_INSTRUCTIONS,
    model: env.AGENT_MODEL,
    outputType: FinanceSafetyReviewSchema,
  });
}

export function getDirectorAgent(): Agent {
  if (!directorAgentInstance) {
    directorAgentInstance = createDirectorAgent();
  }
  return directorAgentInstance;
}

export function getSafetyAgent(): Agent {
  if (!safetyAgentInstance) {
    safetyAgentInstance = createSafetyAgent();
  }
  return safetyAgentInstance;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function optionalString(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) {
    return value;
  }
  return null;
}

function requireString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

function requireNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function parseDirectorState(value: unknown): FinanceDirectorPlan | null {
  if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
    return null;
  }
  const parsed = FinanceDirectorPlanSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseSafetyState(value: unknown): FinanceSafetyReview | null {
  if (!value || (typeof value === 'object' && Object.keys(value as Record<string, unknown>).length === 0)) {
    return null;
  }
  const parsed = FinanceSafetyReviewSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function mapSession(row: Record<string, unknown>): OrchestratorSessionRecord {
  const directorState = parseDirectorState(row.director_state);
  const safetyState = parseSafetyState(row.safety_state);
  return {
    id: requireString(row.id),
    orgId: requireString(row.org_id),
    chatSessionId: optionalString(row.chat_session_id),
    status: (row.status as OrchestratorSessionRecord['status']) ?? 'active',
    directorState,
    safetyState,
    metadata: asRecord(row.metadata),
    currentObjective: optionalString(row.current_objective),
    lastDirectorRunId: optionalString(row.last_director_run_id),
    lastSafetyRunId: optionalString(row.last_safety_run_id),
    createdAt: requireString(row.created_at),
    updatedAt: requireString(row.updated_at),
    closedAt: optionalString(row.closed_at),
  };
}

function mapCommand(row: Record<string, unknown>): OrchestratorCommandRecord {
  return {
    id: requireString(row.id),
    orgId: requireString(row.org_id),
    sessionId: requireString(row.session_id),
    commandType: requireString(row.command_type),
    payload: asRecord(row.payload),
    status: (row.status as OrchestratorCommandRecord['status']) ?? 'queued',
    priority: requireNumber(row.priority, 100),
    scheduledFor: requireString(row.scheduled_for),
    startedAt: optionalString(row.started_at),
    completedAt: optionalString(row.completed_at),
    failedAt: optionalString(row.failed_at),
    result: row.result && typeof row.result === 'object' ? (row.result as Record<string, unknown>) : null,
    lastError: optionalString(row.last_error),
    metadata: asRecord(row.metadata ?? {}),
    createdAt: requireString(row.created_at),
    updatedAt: requireString(row.updated_at),
  };
}

function mapJob(row: Record<string, unknown>): OrchestratorJobRecord {
  return {
    id: requireString(row.id),
    orgId: requireString(row.org_id),
    commandId: requireString(row.command_id),
    worker: (row.worker as OrchestratorJobRecord['worker']) ?? 'director',
    domainAgent: optionalString(row.domain_agent),
    status: (row.status as OrchestratorJobRecord['status']) ?? 'pending',
    attempts: requireNumber(row.attempts, 0),
    scheduledAt: requireString(row.scheduled_at),
    startedAt: optionalString(row.started_at),
    completedAt: optionalString(row.completed_at),
    failedAt: optionalString(row.failed_at),
    lastError: optionalString(row.last_error),
    metadata: asRecord(row.metadata ?? {}),
    createdAt: requireString(row.created_at),
    updatedAt: requireString(row.updated_at),
  };
}

function mapConnector(row: Record<string, unknown>): OrgConnectorRecord {
  return {
    id: requireString(row.id),
    orgId: requireString(row.org_id),
    connectorType: (row.connector_type as ConnectorType) ?? 'erp',
    name: requireString(row.name),
    status: (row.status as ConnectorStatus) ?? 'inactive',
    config: asRecord(row.config),
    metadata: asRecord(row.metadata),
    lastSyncedAt: optionalString(row.last_synced_at),
    lastError: optionalString(row.last_error),
    createdAt: requireString(row.created_at),
    updatedAt: requireString(row.updated_at),
  };
}

async function fetchCommandEnvelope(
  supabase: SupabaseClient,
  commandId: string,
): Promise<OrchestratorCommandEnvelope> {
  const commandQuery = await supabase
    .from('orchestrator_commands')
    .select(
      'id, org_id, session_id, command_type, payload, status, priority, scheduled_for, started_at, completed_at, failed_at, result, last_error, metadata, created_at, updated_at',
    )
    .eq('id', commandId)
    .maybeSingle();

  if (commandQuery.error || !commandQuery.data) {
    throw new Error(commandQuery.error?.message ?? 'command_not_found');
  }

  const command = mapCommand(commandQuery.data as Record<string, unknown>);

  const sessionQuery = await supabase
    .from('orchestrator_sessions')
    .select(
      'id, org_id, chat_session_id, status, director_state, safety_state, metadata, current_objective, last_director_run_id, last_safety_run_id, created_at, updated_at, closed_at',
    )
    .eq('id', command.sessionId)
    .maybeSingle();

  if (sessionQuery.error || !sessionQuery.data) {
    throw new Error(sessionQuery.error?.message ?? 'orchestrator_session_not_found');
  }

  const session = mapSession(sessionQuery.data as Record<string, unknown>);

  const jobQuery = await supabase
    .from('orchestrator_jobs')
    .select('id, org_id, command_id, worker, domain_agent, status, attempts, scheduled_at, started_at, completed_at, failed_at, last_error, metadata, created_at, updated_at')
    .eq('command_id', commandId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobQuery.error || !jobQuery.data) {
    throw new Error(jobQuery.error?.message ?? 'orchestrator_job_not_found');
  }

  const job = mapJob(jobQuery.data as Record<string, unknown>);

  return { command, session, job };
}

export async function getCommandEnvelope(
  supabase: SupabaseClient,
  commandId: string,
): Promise<OrchestratorCommandEnvelope> {
  return fetchCommandEnvelope(supabase, commandId);
}

export async function enqueueDirectorCommand(
  supabase: SupabaseClient,
  input: DirectorCommandInput,
  logger?: OrchestratorLogger,
): Promise<OrchestratorCommandResponse> {
  const rpcResult = await supabase.rpc('enqueue_orchestrator_command', {
    p_org_id: input.orgId,
    p_session_id: input.sessionId,
    p_command_type: input.commandType,
    p_payload: input.payload ?? {},
    p_created_by: input.issuedBy,
    p_priority: input.priority ?? 100,
    p_scheduled_for: input.scheduledFor ?? null,
    p_worker: input.worker ?? 'director',
  });

  if (rpcResult.error || !rpcResult.data) {
    logger?.error?.({ err: rpcResult.error, input }, 'enqueue_orchestrator_command_failed');
    throw new Error(rpcResult.error?.message ?? 'enqueue_orchestrator_command_failed');
  }

  const envelope = await fetchCommandEnvelope(supabase, rpcResult.data as string);

  return {
    commandId: envelope.command.id,
    jobId: envelope.job.id,
    sessionId: envelope.session.id,
    status: envelope.command.status,
    scheduledFor: envelope.command.scheduledFor,
  };
}

export async function runDirectorPlanning(
  supabase: SupabaseClient,
  session: OrchestratorSessionRecord,
  objective: string,
  context: Record<string, unknown>,
  logger?: OrchestratorLogger,
): Promise<FinanceDirectorPlan> {
  const agent = getDirectorAgent();
  const openai = getOpenAI();
  try {
    const input = `${DIRECTOR_INSTRUCTIONS}\n\n${JSON.stringify({ session, objective, context })}`;
    const response = await runAgent(agent, input, {
      model: env.AGENT_MODEL,
      metadata: {
        orgId: session.orgId,
        sessionId: session.id,
        objective,
        kind: 'director_plan',
      },
    } as any);

    let plan = (response as { finalOutput?: FinanceDirectorPlan }).finalOutput;
    await drainAgentStream(response, logger);
    if (!plan) {
      plan = (response as { finalOutput?: FinanceDirectorPlan }).finalOutput;
    }
    if (!plan) {
      throw new Error('director_plan_missing_output');
    }
    ensureDirectorPlanBudget(plan, logger);
    return plan;
  } catch (error) {
    await logOpenAIDebug('director_plan', error, logger);
    logger?.error?.(
      {
        err: error instanceof Error ? error.message : error,
        sessionId: session.id,
        objective,
      },
      'director_plan_failed',
    );
    throw error instanceof Error ? error : new Error('director_plan_failed');
  } finally {
    void openai;
  }
}

export async function runSafetyAssessment(
  supabase: SupabaseClient,
  envelope: OrchestratorCommandEnvelope,
  logger?: OrchestratorLogger,
): Promise<SafetyAssessmentResult> {
  const agent = getSafetyAgent();
  const openai = getOpenAI();
  try {
    const input = `${SAFETY_INSTRUCTIONS}\n\n${JSON.stringify({ session: envelope.session, command: envelope.command, job: envelope.job })}`;
    const response = await runAgent(agent, input, {
      model: env.AGENT_MODEL,
      metadata: {
        orgId: envelope.session.orgId,
        sessionId: envelope.session.id,
        commandId: envelope.command.id,
        kind: 'safety_review',
      },
    } as any);

    const review = (response as { finalOutput?: FinanceSafetyReview }).finalOutput;
    if (!review) {
      return {
        status: 'needs_hitl',
        reasons: ['Safety review missing output, escalate to human'],
      };
    }

    const decision = review.decision;
    const refusalReasons = review.refusal ? [review.refusal.reason] : [];
    const reasons = [...decision.reasons, ...refusalReasons];
    const mitigations = decision.mitigations;

    if (review.refusal || decision.status === 'rejected') {
      return { status: 'rejected', reasons, mitigations };
    }
    if (decision.status === 'needs_hitl' || decision.hitlRequired) {
      return { status: 'needs_hitl', reasons, mitigations };
    }
    return {
      status: 'approved',
      reasons,
      mitigations,
    };
  } catch (error) {
    await logOpenAIDebug('safety_review', error, logger);
    logger?.error?.(
      {
        err: error instanceof Error ? error.message : error,
        commandId: envelope.command.id,
      },
      'safety_review_failed',
    );
    return {
      status: 'needs_hitl',
      reasons: ['Safety agent failure, escalate to human'],
    };
  } finally {
    void openai;
  }
}

export async function listPendingJobs(
  supabase: SupabaseClient,
  orgId: string,
  worker: OrchestratorJobRecord['worker'],
  limit = 10,
): Promise<OrchestratorCommandEnvelope[]> {
  const jobQuery = await supabase
    .from('orchestrator_jobs')
    .select('id, org_id, command_id, worker, domain_agent, status, attempts, scheduled_at, started_at, completed_at, failed_at, last_error, metadata, created_at, updated_at')
    .eq('org_id', orgId)
    .eq('worker', worker)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (jobQuery.error) {
    throw new Error(jobQuery.error.message);
  }

  const envelopes: OrchestratorCommandEnvelope[] = [];
  for (const row of jobQuery.data ?? []) {
    const job = mapJob(row as Record<string, unknown>);
    const envelope = await fetchCommandEnvelope(supabase, job.commandId);
    envelopes.push(envelope);
  }
  return envelopes;
}

export async function listCommandsForSession(
  supabase: SupabaseClient,
  sessionId: string,
  limit = 50,
): Promise<OrchestratorCommandRecord[]> {
  const query = await supabase
    .from('orchestrator_commands')
    .select(
      'id, org_id, session_id, command_type, payload, status, priority, scheduled_for, started_at, completed_at, failed_at, result, last_error, metadata, created_at, updated_at',
    )
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (query.error) {
    throw new Error(query.error.message);
  }

  return (query.data ?? []).map((row) => mapCommand(row as Record<string, unknown>));
}

export async function listOrgConnectors(
  supabase: SupabaseClient,
  orgId: string,
): Promise<OrgConnectorRecord[]> {
  const query = await supabase
    .from('org_connectors')
    .select('id, org_id, connector_type, name, status, config, metadata, last_synced_at, last_error, created_at, updated_at')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (query.error) {
    throw new Error(query.error.message);
  }

  return (query.data ?? []).map((row) => mapConnector(row as Record<string, unknown>));
}

export async function updateCommandStatus(
  supabase: SupabaseClient,
  commandId: string,
  status: OrchestratorCommandRecord['status'],
  patch: Record<string, unknown>,
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    status,
    ...patch,
  };

  const { error } = await supabase
    .from('orchestrator_commands')
    .update(updatePayload)
    .eq('id', commandId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateJobStatus(
  supabase: SupabaseClient,
  jobId: string,
  status: OrchestratorJobRecord['status'],
  patch: Partial<{
    attempts: number;
    lastError: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    metadata: Record<string, unknown>;
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = {
    status,
    ...patch,
  };

  const { error } = await supabase
    .from('orchestrator_jobs')
    .update(payload)
    .eq('id', jobId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function registerConnector(
  supabase: SupabaseClient,
  input: RegisterConnectorInput,
): Promise<string> {
  const rpcResult = await supabase.rpc('register_org_connector', {
    p_org_id: input.orgId,
    p_connector_type: input.connectorType,
    p_name: input.name,
    p_config: input.config ?? {},
    p_status: input.status ?? 'pending',
    p_metadata: input.metadata ?? {},
    p_created_by: input.createdBy ?? null,
  });

  if (rpcResult.error || !rpcResult.data) {
    throw new Error(rpcResult.error?.message ?? 'register_connector_failed');
  }

  return rpcResult.data as string;
}

export async function updateSessionState(
  supabase: SupabaseClient,
  input: UpdateSessionStateInput,
): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (input.directorState !== undefined) {
    if (input.directorState === null) {
      patch.director_state = {};
    } else {
      patch.director_state = FinanceDirectorPlanSchema.parse(input.directorState);
    }
  }
  if (input.safetyState !== undefined) {
    if (input.safetyState === null) {
      patch.safety_state = {};
    } else {
      patch.safety_state = FinanceSafetyReviewSchema.parse(input.safetyState);
    }
  }
  if (input.metadata) {
    patch.metadata = input.metadata;
  }
  if (input.currentObjective !== undefined) {
    patch.current_objective = input.currentObjective;
  }
  if (input.status) {
    patch.status = input.status;
  }
  if (input.lastDirectorRunId !== undefined) {
    patch.last_director_run_id = input.lastDirectorRunId;
  }
  if (input.lastSafetyRunId !== undefined) {
    patch.last_safety_run_id = input.lastSafetyRunId;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  const { error } = await supabase
    .from('orchestrator_sessions')
    .update(patch)
    .eq('id', input.sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

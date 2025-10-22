import { createApp } from './app.js';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { diffWordsWithSpace } from 'diff';
import type { IRACPayload } from '@avocat-ai/shared';
import { z } from 'zod';
import { env } from './config.js';
import { IRACPayloadSchema } from './schemas/irac.js';
import { getOpenAI, logOpenAIDebug, setOpenAILogger } from './openai.js';
import { getHybridRetrievalContext, runLegalAgent } from './agent-wrapper.js';
import { summariseDocumentFromPayload } from './summarization.js';
// Defer finance workers to runtime without affecting typecheck
try {
  const dyn = new Function('p', 'return import(p)');
  const maybePromise = (dyn as any)('./finance-workers.js');
  if (maybePromise && typeof maybePromise.then === 'function') {
    void maybePromise.catch(() => {});
  }
} catch {}
import { z as zod } from 'zod';
import {
  buildTransparencyReport,
  buildRetrievalMetricsResponse,
  buildEvaluationMetricsResponse,
  type RetrievalHostRow,
  type RetrievalOriginRow,
  type RetrievalSummaryRow,
  type EvaluationMetricsSummaryRow,
  type EvaluationJurisdictionRow,
  summariseCepej,
  summariseEvaluations,
  summariseHitl,
  summariseIngestion,
  summariseRuns,
  summariseSlo,
  mapLearningReports,
  type LearningReportRow,
  type CepejRecord,
  type EvaluationRecord,
  type HitlRecord,
  type IngestionRecord,
  type RunRecord,
  type SloSnapshotRecord,
} from './reports.js';
import {
  listSsoConnections,
  upsertSsoConnection,
  deleteSsoConnection,
  listScimTokens,
  createScimToken,
  deleteScimToken,
  listIpAllowlist,
  upsertIpAllowlist,
  deleteIpAllowlist,
} from './sso.js';
import { listScimUsers, createScimUser, patchScimUser, deleteScimUser } from './scim.js';
import type { ScimUserPayload } from './scim.js';
import type { ScimPatchRequest } from './scim.js';
import { logAuditEvent } from './audit.js';
import { registerChatkitRoutes } from './http/routes/chatkit.js';
import { registerOrchestratorRoutes } from './http/routes/orchestrator.js';
import { authorizeRequestWithGuards } from './http/authorization.js';
import { supabase } from './supabase-client.js';
import { listDeviceSessions, revokeDeviceSession } from './device-sessions.js';
import { makeStoragePath } from './storage.js';
import { buildPhaseCProcessNavigator, buildPhaseCWorkspaceDesk } from './workspace.js';
import { registerWorkspaceRoutes } from './domain/workspace/routes.js';
import { createRateLimitGuard, createRateLimiterFactory } from './rate-limit.js';
import { withRequestSpan } from './observability/spans.js';
import { incrementCounter } from './observability/metrics.js';
import { enqueueRegulatorDigest, listRegulatorDigestsForOrg } from './launch.js';

const { app, context } = await createApp();

setOpenAILogger(app.log);

const limiterFactory = createRateLimiterFactory({
  enabled: env.RATE_LIMIT_ENABLED,
  provider: env.RATE_LIMIT_PROVIDER,
  redis:
    env.RATE_LIMIT_PROVIDER === 'redis'
      ? {
          url: env.RATE_LIMIT_REDIS_URL,
        }
      : undefined,
  supabase:
    env.RATE_LIMIT_PROVIDER === 'supabase'
      ? {
          client: supabase,
          functionName: env.RATE_LIMIT_SUPABASE_FUNCTION,
        }
      : undefined,
  logger: app.log,
});

const telemetryLimiter = limiterFactory.create('telemetry', {
  limit: env.RATE_LIMIT_TELEMETRY_LIMIT,
  windowMs: env.RATE_LIMIT_TELEMETRY_WINDOW_SECONDS * 1000,
});

const telemetryRateLimitGuard = createRateLimitGuard(telemetryLimiter, {
  name: 'telemetry',
  limit: env.RATE_LIMIT_TELEMETRY_LIMIT,
  windowMs: env.RATE_LIMIT_TELEMETRY_WINDOW_SECONDS * 1000,
  logger: app.log,
});

const runsRateLimitGuard = createRateLimitGuard(
  limiterFactory.create('runs', {
    limit: env.RATE_LIMIT_RUNS_LIMIT,
    windowMs: env.RATE_LIMIT_RUNS_WINDOW_SECONDS * 1000,
  }),
  {
    name: 'runs',
    limit: env.RATE_LIMIT_RUNS_LIMIT,
    windowMs: env.RATE_LIMIT_RUNS_WINDOW_SECONDS * 1000,
    logger: app.log,
  },
);

const workspaceRateLimitGuard = createRateLimitGuard(
  limiterFactory.create('workspace', {
    limit: env.RATE_LIMIT_WORKSPACE_LIMIT,
    windowMs: env.RATE_LIMIT_WORKSPACE_WINDOW_SECONDS * 1000,
  }),
  {
    name: 'workspace',
    limit: env.RATE_LIMIT_WORKSPACE_LIMIT,
    windowMs: env.RATE_LIMIT_WORKSPACE_WINDOW_SECONDS * 1000,
    logger: app.log,
  },
);

const complianceRateLimitGuard = createRateLimitGuard(
  limiterFactory.create('compliance', {
    limit: env.RATE_LIMIT_COMPLIANCE_LIMIT,
    windowMs: env.RATE_LIMIT_COMPLIANCE_WINDOW_SECONDS * 1000,
  }),
  {
    name: 'compliance',
    limit: env.RATE_LIMIT_COMPLIANCE_LIMIT,
    windowMs: env.RATE_LIMIT_COMPLIANCE_WINDOW_SECONDS * 1000,
    logger: app.log,
  },
);

context.rateLimits.workspace = workspaceRateLimitGuard;

await registerWorkspaceRoutes(app, context);

async function embedQuery(text: string): Promise<number[]> {
  const openai = getOpenAI();

  try {
    const response = await openai.embeddings.create({
      model: env.EMBEDDING_MODEL,
      input: text,
    });

    const embedding = response.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      throw new Error('embedding_empty');
    }

    return embedding as number[];
  } catch (error) {
    await logOpenAIDebug('embed_query', error, app.log);
    const message = error instanceof Error ? error.message : 'embedding_failed';
    throw new Error(message);
  }
}

const COMPLIANCE_ACK_TYPES = {
  consent: 'ai_assist',
  councilOfEurope: 'council_of_europe_disclosure',
} as const;

type AcknowledgementEvent = {
  type: string;
  version: string;
  created_at: string | null;
};

const toStringArray = (input: unknown): string[] =>
  Array.isArray(input) ? input.filter((value): value is string => typeof value === 'string') : [];

async function fetchAcknowledgementEvents(orgId: string, userId: string): Promise<AcknowledgementEvent[]> {
  const { data, error } = await supabase
    .from('consent_events')
    .select('consent_type, version, created_at, org_id')
    .eq('user_id', userId)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .in('consent_type', [COMPLIANCE_ACK_TYPES.consent, COMPLIANCE_ACK_TYPES.councilOfEurope])
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ consent_type?: unknown; version?: unknown; created_at?: string | null }>;
  const events: AcknowledgementEvent[] = [];
  for (const row of rows) {
    if (typeof row.consent_type !== 'string' || typeof row.version !== 'string') {
      continue;
    }
    events.push({ type: row.consent_type, version: row.version, created_at: row.created_at ?? null });
  }
  return events;
}

type ConsentEventInsert = {
  org_id: string | null;
  user_id: string;
  consent_type: string;
  version: string;
};

async function recordAcknowledgementEvents(
  request: FastifyRequest,
  orgId: string,
  userId: string,
  records: ConsentEventInsert[],
) {
  if (records.length === 0) {
    return;
  }

  await withRequestSpan(
    request,
    {
      name: 'compliance.acknowledgements.persist',
      attributes: { orgId, userId, recordCount: records.length },
    },
    async ({ logger, setAttribute }) => {
      const payload = records.map((record) => ({
        org_id: record.org_id,
        user_id: record.user_id,
        consent_type: record.consent_type,
        version: record.version,
      }));

      const { error } = await supabase.rpc('record_consent_events', { events: payload });

      if (error) {
        setAttribute('errorCode', error.code ?? 'unknown');
        logger.error({ err: error }, 'compliance_ack_persist_failed');
        throw error;
      }

      setAttribute('persisted', true);
      incrementCounter('compliance_acknowledgements.recorded', {
        consent_types: records
          .map((record) => record.consent_type)
          .sort()
          .join(',') || 'none',
      });
    },
  );
}

function summariseAcknowledgements(
  access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>,
  events: AcknowledgementEvent[],
) {
  const latestByType = new Map<string, { version: string; created_at: string | null }>();
  for (const event of events) {
    if (!latestByType.has(event.type)) {
      latestByType.set(event.type, { version: event.version, created_at: event.created_at });
    }
  }

  const consentRequirement = access.consent.requirement;
  const councilRequirement = access.councilOfEurope.requirement;
  const consentAck = latestByType.get(COMPLIANCE_ACK_TYPES.consent);
  const councilAck = latestByType.get(COMPLIANCE_ACK_TYPES.councilOfEurope);

  const consentSatisfied =
    !consentRequirement || consentAck?.version === consentRequirement.version || access.consent.latest?.version === consentRequirement.version;
  const councilSatisfied =
    !councilRequirement?.version || councilAck?.version === councilRequirement.version || access.councilOfEurope.acknowledgedVersion === councilRequirement.version;

  return {
    consent: {
      requiredVersion: consentRequirement?.version ?? null,
      acknowledgedVersion: consentAck?.version ?? access.consent.latest?.version ?? null,
      acknowledgedAt: consentAck?.created_at ?? null,
      satisfied: consentSatisfied,
    },
    councilOfEurope: {
      requiredVersion: councilRequirement?.version ?? null,
      acknowledgedVersion: councilAck?.version ?? access.councilOfEurope.acknowledgedVersion ?? null,
      acknowledgedAt: councilAck?.created_at ?? null,
      satisfied: councilSatisfied,
    },
  };
}

type ComplianceAssessment = {
  fria: { required: boolean; reasons: string[] };
  cepej: { passed: boolean; violations: string[] };
  statute: { passed: boolean; violations: string[] };
  disclosures: {
    consentSatisfied: boolean;
    councilSatisfied: boolean;
    missing: string[];
    requiredConsentVersion: string | null;
    acknowledgedConsentVersion: string | null;
    requiredCoeVersion: string | null;
    acknowledgedCoeVersion: string | null;
  };
};

function mergeDisclosuresWithAcknowledgements(
  assessment: ComplianceAssessment,
  acknowledgements: ReturnType<typeof summariseAcknowledgements>,
): ComplianceAssessment['disclosures'] {
  const missing = new Set(assessment.disclosures.missing);
  if (!acknowledgements.consent.satisfied) {
    missing.add('consent');
  }
  if (!acknowledgements.councilOfEurope.satisfied) {
    missing.add('council_of_europe');
  }

  return {
    ...assessment.disclosures,
    consentSatisfied: acknowledgements.consent.satisfied,
    councilSatisfied: acknowledgements.councilOfEurope.satisfied,
    missing: Array.from(missing),
    requiredConsentVersion: acknowledgements.consent.requiredVersion,
    acknowledgedConsentVersion: acknowledgements.consent.acknowledgedVersion,
    requiredCoeVersion: acknowledgements.councilOfEurope.requiredVersion,
    acknowledgedCoeVersion: acknowledgements.councilOfEurope.acknowledgedVersion,
  };
}

class ResidencyError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function extractResidencyFromPath(path?: string | null): string | null {
  if (!path) {
    return null;
  }
  const segments = path.split('/');
  return segments.length > 1 ? segments[1] ?? null : null;
}

function collectAllowedResidencyZones(
  access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>,
): string[] {
  const zones = new Set<string>();

  const append = (value: string | null | undefined) => {
    if (!value) return;
    const normalized = value.trim().toLowerCase();
    if (normalized) {
      zones.add(normalized);
    }
  };

  if (Array.isArray(access.policies.residencyZones)) {
    for (const zone of access.policies.residencyZones) {
      append(zone);
    }
  }
  append(access.policies.residencyZone ?? null);

  return zones.size > 0 ? Array.from(zones) : [];
}

async function determineResidencyZone(
  orgId: string,
  access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>,
  requestedZone?: string | null,
): Promise<string> {
  const requested = typeof requestedZone === 'string' ? requestedZone.trim().toLowerCase() : '';
  const candidates = [
    requested,
    ...collectAllowedResidencyZones(access),
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  const zone = (candidates[0] ?? 'eu').trim().toLowerCase();

  const { data: isAllowedZone, error: allowedError } = await supabase.rpc('storage_residency_allowed', { code: zone });
  if (allowedError) {
    throw new ResidencyError('residency_validation_failed', 500);
  }
  if (isAllowedZone !== true) {
    throw new ResidencyError('residency_zone_invalid', 400);
  }

  const { data: orgAllowed, error: orgAllowedError } = await supabase.rpc('org_residency_allows', {
    org_uuid: orgId,
    zone,
  });
  if (orgAllowedError) {
    throw new ResidencyError('residency_validation_failed', 500);
  }
  if (orgAllowed !== true) {
    throw new ResidencyError('residency_zone_restricted', 428);
  }

  return zone;
}

const complianceAckSchema = z
  .object({
    consent: z
      .object({
        type: z.string().min(1),
        version: z.string().min(1),
      })
      .nullable()
      .optional(),
    councilOfEurope: z
      .object({
        version: z.string().min(1),
      })
      .nullable()
      .optional(),
  })
  .refine((value) => Boolean(value.consent || value.councilOfEurope), {
    message: 'At least one acknowledgement must be provided.',
  });

const regulatorDigestSchema = z
  .object({
    jurisdiction: z.string().min(2),
    channel: z.enum(['email', 'slack', 'teams']),
    frequency: z.enum(['weekly', 'monthly']),
    recipients: z.array(z.string().email()).min(1),
    topics: z.array(z.string().min(2)).max(10).optional(),
  })
  .strict();

const regulatorDigestQuerySchema = z
  .object({
    orgId: z.string().uuid(),
    limit: z.coerce.number().int().positive().max(50).optional(),
  })
  .strict();

// route schemas moved to dedicated modules (see ./http/schemas)

interface IncidentRow {
  id: string;
  occurred_at: string;
  detected_at: string | null;
  resolved_at: string | null;
  severity: string | null;
  status: string | null;
  title: string | null;
  summary: string | null;
  impact: string | null;
  resolution: string | null;
  follow_up: string | null;
  evidence_url: string | null;
  recorded_at: string;
}

interface ChangeLogRow {
  id: string;
  entry_date: string;
  recorded_at: string;
  title: string | null;
  category: string | null;
  summary: string | null;
  release_tag: string | null;
  links: unknown;
}

registerChatkitRoutes(app, { supabase });
registerOrchestratorRoutes(app, { supabase });

const GO_NO_GO_SECTIONS = new Set(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
const GO_NO_GO_STATUSES = new Set(['pending', 'satisfied']);
const GO_NO_GO_DECISIONS = new Set(['go', 'no-go']);
const FRIA_CRITERION = 'EU AI Act (high-risk): FRIA completed';

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toNumberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  const record: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed)) {
      record[key] = parsed;
    }
  }
  return record;
}

function clampRate(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }
  if (value === Infinity || value === -Infinity) {
    return null;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function normaliseFairnessJurisdiction(entry: unknown): Record<string, unknown> | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const payload = entry as Record<string, unknown>;
  const code = typeof payload.code === 'string' ? payload.code : null;
  if (!code) {
    return null;
  }
  const totalRuns =
    toNumber(payload.totalRuns) ??
    toNumber(payload.total) ??
    toNumber(payload.total_runs) ??
    0;
  const hitlEscalations =
    toNumber(payload.hitlEscalations) ??
    toNumber(payload.hitl) ??
    toNumber(payload.hitl_escalations) ??
    0;
  const hitlRate = clampRate(
    toNumber(payload.hitlRate) ?? toNumber(payload.hitl_rate) ??
      (totalRuns > 0 ? hitlEscalations / totalRuns : null),
  );
  const highRiskShare = clampRate(
    toNumber(payload.highRiskShare) ?? toNumber(payload.high_risk_share) ?? null,
  );

  return {
    code,
    totalRuns,
    hitlEscalations,
    hitlRate,
    highRiskShare,
  };
}

function normaliseFairnessBenchmark(entry: unknown): Record<string, unknown> | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const payload = entry as Record<string, unknown>;
  const name = typeof payload.name === 'string' ? payload.name : null;
  if (!name) {
    return null;
  }
  const evaluated = toNumber(payload.evaluated) ?? toNumber(payload.total) ?? 0;
  const passRate = clampRate(toNumber(payload.passRate) ?? toNumber(payload.pass_rate) ?? null);

  return {
    name,
    evaluated,
    passRate,
  };
}

function normaliseFairnessOverall(value: Record<string, unknown>): Record<string, unknown> {
  const totalRuns = toNumber(value.totalRuns) ?? toNumber(value.total) ?? null;
  const hitlRate = clampRate(toNumber(value.hitlRate) ?? toNumber(value.hitl_rate) ?? null);
  const highRiskShare = clampRate(
    toNumber(value.highRiskShare) ?? toNumber(value.high_risk_share) ?? null,
  );
  const benchmarkRate = clampRate(
    toNumber(value.benchmarkRate) ?? toNumber(value.benchmark_rate) ?? null,
  );

  return {
    totalRuns,
    hitlRate,
    highRiskShare,
    benchmarkRate,
  };
}

function deriveEliFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter((segment) => segment.length > 0);
    const eliIndex = parts.indexOf('eli');
    if (eliIndex >= 0 && eliIndex + 1 < parts.length) {
      return parts.slice(eliIndex + 1).join('/');
    }
    if (parsed.hostname.includes('legisquebec.gouv.qc.ca') && parts.length >= 2) {
      return `legisquebec/${parts.slice(-2).join('/')}`;
    }
    if (parsed.hostname.includes('laws-lois.justice.gc.ca')) {
      return parts.join('/');
    }
  } catch (_error) {
    return null;
  }
  return null;
}

const ECLI_URL_REGEX = /ECLI:([A-Z0-9:_.-]+)/i;

function deriveEcliFromUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  if (ECLI_URL_REGEX.test(url)) {
    const match = url.match(ECLI_URL_REGEX);
    return match ? `ECLI:${match[1].toUpperCase()}` : null;
  }

  try {
    const parsed = new URL(url);
    const upperHost = parsed.hostname.toUpperCase();
    if (upperHost.includes('COURDECASSATION.BE') && parsed.pathname.includes('/ID/')) {
      const token = parsed.pathname.split('/ID/')[1];
      return token ? `ECLI:BE:CSC:${token.toUpperCase()}` : null;
    }
    if (upperHost.includes('COURDECASSATION.FR') && parsed.pathname.includes('/DECISION/')) {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const slug = parts[parts.length - 1] ?? '';
      if (slug) {
        return `ECLI:FR:CCASS:${slug.replace(/[^A-Z0-9]/gi, '').toUpperCase()}`;
      }
    }
    if (upperHost.includes('CANLII.CA') && parsed.pathname.length > 1) {
      const canonical = parsed.pathname.replace(/\//g, '').toUpperCase();
      return canonical ? `ECLI:CA:${canonical}` : null;
    }
  } catch (_error) {
    return null;
  }
  return null;
}

const ECLI_TEXT_REGEX = /ECLI:[A-Z]{2}:[A-Z0-9]+:[A-Z0-9_.:-]+/i;

function extractEcliFromText(text: string | null | undefined): string | null {
  if (!text) {
    return null;
  }
  const match = text.match(ECLI_TEXT_REGEX);
  return match ? match[0].toUpperCase() : null;
}

function minutesBetween(startIso: string | null | undefined, end: Date): number | null {
  if (!startIso) {
    return null;
  }
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  const diffMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return null;
  }
  return diffMs / (1000 * 60);
}

function bucketResolution(minutes: number | null): string | null {
  if (minutes === null || Number.isNaN(minutes)) {
    return null;
  }
  if (minutes <= 30) {
    return 'under_30m';
  }
  if (minutes <= 120) {
    return 'under_2h';
  }
  if (minutes <= 480) {
    return 'under_8h';
  }
  if (minutes <= 1440) {
    return 'under_24h';
  }
  return 'over_24h';
}

function parseEvidenceNotes(value: unknown): Record<string, unknown> | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return { message: value };
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error('invalid_notes');
}

async function refreshFriaEvidence(orgId: string, actorId: string): Promise<void> {
  const { data, error } = await supabase
    .from('fria_artifacts')
    .select('release_tag, evidence_url, submitted_by, submitted_at, validated')
    .eq('org_id', orgId)
    .order('submitted_at', { ascending: false });

  if (error) {
    app.log.error({ err: error, orgId }, 'fria artifact fetch failed');
    return;
  }

  const artifacts = (data ?? []).filter((item) => item.validated === true);
  const status = artifacts.length > 0 ? 'satisfied' : 'pending';
  const releases = Array.from(
    new Set(
      artifacts
        .map((item) => item.release_tag)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    ),
  );

  const notes: Record<string, unknown> = {
    validatedCount: artifacts.length,
  };
  if (releases.length > 0) {
    notes.releases = releases;
  }

  const evidenceUrl = artifacts[0]?.evidence_url ?? null;
  const recordedBy = artifacts[0]?.submitted_by ?? actorId;
  const recordedAt = artifacts[0]?.submitted_at ?? new Date().toISOString();

  const { error: upsertError } = await supabase.from('go_no_go_evidence').upsert(
    {
      org_id: orgId,
      section: 'A',
      criterion: FRIA_CRITERION,
      status,
      evidence_url: evidenceUrl,
      notes,
      recorded_by: recordedBy,
      recorded_at: recordedAt,
    },
    { onConflict: 'org_id,section,criterion' },
  );

  if (upsertError) {
    app.log.error({ err: upsertError, orgId }, 'fria evidence upsert failed');
  }
}

const extractCountry = (value: unknown): string | null => {
  if (value && typeof value === 'object' && 'country' in (value as Record<string, unknown>)) {
    const country = (value as { country?: unknown }).country;
    return typeof country === 'string' ? country : null;
  }
  return null;
};

function resolveDateRange(startParam?: string, endParam?: string): { start: string; end: string } {
  const now = new Date();
  const end = endParam ? new Date(endParam) : now;
  if (Number.isNaN(end.getTime())) {
    throw new Error('invalid_end_date');
  }
  const defaultStart = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const start = startParam ? new Date(startParam) : defaultStart;
  if (Number.isNaN(start.getTime())) {
    throw new Error('invalid_start_date');
  }
  if (start.getTime() > end.getTime()) {
    throw new Error('start_after_end');
  }
  const startIso = new Date(start).toISOString();
  const endIso = new Date(end).toISOString();
  return { start: startIso, end: endIso };
}

app.get('/compliance/acknowledgements', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const orgHeader = request.headers['x-org-id'];
  if (!orgHeader || typeof orgHeader !== 'string') {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }

  if (await complianceRateLimitGuard(request, reply, ['ack:get', orgHeader, userHeader])) {
    return;
  }

  let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
  try {
    access = await withRequestSpan(
      request,
      {
        name: 'compliance.acknowledgements.authorize',
        attributes: { orgId: orgHeader, userId: userHeader },
      },
      async () => authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request),
    );
  } catch (error) {
    const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return reply.code(status).send({ error: 'forbidden' });
  }

  try {
    const events = await withRequestSpan(
      request,
      {
        name: 'compliance.acknowledgements.fetch',
        attributes: { orgId: orgHeader, userId: userHeader },
      },
      async ({ setAttribute }) => {
        const result = await fetchAcknowledgementEvents(orgHeader, userHeader);
        setAttribute('eventCount', result.length);
        return result;
      },
    );

    const acknowledgements = summariseAcknowledgements(access, events);
    return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
  } catch (error) {
    request.log.error({ err: error }, 'compliance_ack_fetch_failed');
    return reply.code(500).send({ error: 'compliance_ack_fetch_failed' });
  }
});

app.post<{ Body: z.infer<typeof complianceAckSchema> }>('/compliance/acknowledgements', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const orgHeader = request.headers['x-org-id'];
  if (!orgHeader || typeof orgHeader !== 'string') {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }

  if (await complianceRateLimitGuard(request, reply, ['ack:post', orgHeader, userHeader])) {
    return;
  }

  const parsed = complianceAckSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
  try {
    access = await withRequestSpan(
      request,
      {
        name: 'compliance.acknowledgements.authorize',
        attributes: { orgId: orgHeader, userId: userHeader },
      },
      async () => authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request),
    );
  } catch (error) {
    const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return reply.code(status).send({ error: 'forbidden' });
  }

  const records: ConsentEventInsert[] = [];
  if (parsed.data.consent) {
    records.push({
      user_id: userHeader,
      org_id: orgHeader,
      consent_type: parsed.data.consent.type,
      version: parsed.data.consent.version,
    });
  }
  if (parsed.data.councilOfEurope) {
    records.push({
      user_id: userHeader,
      org_id: orgHeader,
      consent_type: COMPLIANCE_ACK_TYPES.councilOfEurope,
      version: parsed.data.councilOfEurope.version,
    });
  }

  try {
    await recordAcknowledgementEvents(request, orgHeader, userHeader, records);
  } catch (error) {
    return reply.code(500).send({ error: 'compliance_ack_insert_failed' });
  }

  const events = await withRequestSpan(
    request,
    {
      name: 'compliance.acknowledgements.refresh',
      attributes: { orgId: orgHeader, userId: userHeader },
    },
    async ({ setAttribute }) => {
      const result = await fetchAcknowledgementEvents(orgHeader, userHeader);
      setAttribute('eventCount', result.length);
      return result;
    },
  );

  const acknowledgements = summariseAcknowledgements(access, events);
  return reply.send({ orgId: orgHeader, userId: userHeader, acknowledgements });
});

app.get<{
  Querystring: { limit?: string };
}>('/compliance/status', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const orgHeader = request.headers['x-org-id'];
  if (!orgHeader || typeof orgHeader !== 'string') {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }

  if (await complianceRateLimitGuard(request, reply, ['status:get', orgHeader, userHeader])) {
    return;
  }

  let access;
  try {
    access = await authorizeRequestWithGuards('workspace:view', orgHeader, userHeader, request);
  } catch (error) {
    const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return reply.code(status).send({ error: 'forbidden' });
  }

  const rawLimit = (request.query?.limit ?? '5') as string;
  const parsedLimit = Number.parseInt(rawLimit, 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(25, Math.max(1, Math.floor(parsedLimit))) : 5;

  const [assessmentsResult, events] = await Promise.all([
    supabase
      .from('compliance_assessments')
      .select(
        'run_id, created_at, fria_required, fria_reasons, cepej_passed, cepej_violations, statute_passed, statute_violations, disclosures_missing',
      )
      .eq('org_id', orgHeader)
      .order('created_at', { ascending: false })
      .limit(limit),
    fetchAcknowledgementEvents(orgHeader, userHeader),
  ]);

  if (assessmentsResult.error) {
    request.log.error({ err: assessmentsResult.error }, 'compliance_status_query_failed');
    return reply.code(500).send({ error: 'compliance_status_query_failed' });
  }

  const acknowledgements = summariseAcknowledgements(access, events);

  const history = (assessmentsResult.data ?? []).map((row) => {
    const missing = toStringArray((row as { disclosures_missing?: unknown }).disclosures_missing);
    const assessment: ComplianceAssessment = {
      fria: {
        required: Boolean((row as { fria_required?: boolean | null }).fria_required),
        reasons: toStringArray((row as { fria_reasons?: unknown }).fria_reasons),
      },
      cepej: {
        passed: (row as { cepej_passed?: boolean | null }).cepej_passed ?? true,
        violations: toStringArray((row as { cepej_violations?: unknown }).cepej_violations),
      },
      statute: {
        passed: (row as { statute_passed?: boolean | null }).statute_passed ?? true,
        violations: toStringArray((row as { statute_violations?: unknown }).statute_violations),
      },
      disclosures: {
        consentSatisfied: !missing.includes('consent'),
        councilSatisfied: !missing.includes('council_of_europe'),
        missing,
        requiredConsentVersion: null,
        acknowledgedConsentVersion: null,
        requiredCoeVersion: null,
        acknowledgedCoeVersion: null,
      },
    };

    return {
      runId: (row as { run_id?: string | null }).run_id ?? null,
      createdAt: (row as { created_at?: string | null }).created_at ?? null,
      assessment,
    };
  });

  if (history.length > 0) {
    history[0].assessment = {
      ...history[0].assessment,
      disclosures: mergeDisclosuresWithAcknowledgements(history[0].assessment, acknowledgements),
    };
  }

  const totals = history.reduce(
    (acc, entry) => {
      if (entry.assessment.fria.required) acc.friaRequired += 1;
      if (!entry.assessment.cepej.passed) acc.cepejViolations += 1;
      if (!entry.assessment.statute.passed) acc.statuteViolations += 1;
      if (entry.assessment.disclosures.missing.length > 0) acc.disclosureGaps += 1;
      return acc;
    },
    { total: history.length, friaRequired: 0, cepejViolations: 0, statuteViolations: 0, disclosureGaps: 0 },
  );

  return reply.send({
    orgId: orgHeader,
    userId: userHeader,
    acknowledgements,
    latest: history[0] ?? null,
    history,
    totals,
  });
});

app.post<{ Body: z.infer<typeof regulatorDigestSchema> }>('/launch/digests', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const orgHeader = request.headers['x-org-id'];
  if (!orgHeader || typeof orgHeader !== 'string') {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }

  const parsed = regulatorDigestSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  try {
    await authorizeRequestWithGuards('governance:dispatch', orgHeader, userHeader, request);
  } catch (error) {
    const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return reply.code(status).send({ error: 'forbidden' });
  }

  try {
    const digest = await withRequestSpan(
      request,
      {
        name: 'launch.regulator_digests.enqueue',
        attributes: {
          orgId: orgHeader,
          userId: userHeader,
          channel: parsed.data.channel,
          frequency: parsed.data.frequency,
        },
      },
      async ({ setAttribute }) => {
        const entry = enqueueRegulatorDigest({
          ...parsed.data,
          orgId: orgHeader,
          requestedBy: userHeader,
        });
        setAttribute('digestId', entry.id);
        setAttribute('recipientCount', entry.recipients.length);
        return entry;
      },
    );

    incrementCounter('launch.regulator_digest.queued', {
      channel: digest.channel,
      frequency: digest.frequency,
    });

    return reply.code(201).send({ digest });
  } catch (error) {
    request.log.error({ err: error }, 'regulator_digest_enqueue_failed');
    return reply.code(500).send({ error: 'regulator_digest_enqueue_failed' });
  }
});

app.get<{ Querystring: z.infer<typeof regulatorDigestQuerySchema> }>('/launch/digests', async (request, reply) => {
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(401).send({ error: 'unauthorized' });
  }
  const orgHeader = request.headers['x-org-id'];
  if (!orgHeader || typeof orgHeader !== 'string') {
    return reply.code(400).send({ error: 'x-org-id header is required' });
  }

  const parsed = regulatorDigestQuerySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
  }

  if (parsed.data.orgId !== orgHeader) {
    return reply.code(403).send({ error: 'org_mismatch' });
  }

  try {
    await authorizeRequestWithGuards('governance:dispatch', orgHeader, userHeader, request);
  } catch (error) {
    const status = (error as Error & { statusCode?: number }).statusCode ?? 403;
    return reply.code(status).send({ error: 'forbidden' });
  }

  const limit = parsed.data.limit ?? 25;

  const digests = await withRequestSpan(
    request,
    {
      name: 'launch.regulator_digests.list',
      attributes: { orgId: parsed.data.orgId, userId: userHeader, limit },
    },
    async ({ setAttribute }) => {
      const all = listRegulatorDigestsForOrg(parsed.data.orgId);
      const slice = all.slice(0, limit);
      setAttribute('digestCount', slice.length);
      return slice;
    },
  );

  return reply.send({ orgId: parsed.data.orgId, digests });
});

app.get('/healthz', async () => ({ status: 'ok' }));

app.post<{
  Body: { question: string; context?: string; orgId?: string; userId?: string; confidentialMode?: boolean };
}>('/runs', async (request, reply) => {
  const bodySchema = z.object({
    question: z.string().min(1),
    context: z.string().optional(),
    orgId: z.string().uuid(),
    userId: z.string().uuid(),
    confidentialMode: z.coerce.boolean().optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { question, context, orgId, userId, confidentialMode } = parsed.data;

  if (await runsRateLimitGuard(request, reply, [orgId, userId])) {
    return;
  }

  try {
    const access = await authorizeRequestWithGuards('runs:execute', orgId, userId, request);
    const effectiveConfidential = access.policies.confidentialMode || Boolean(confidentialMode);
    const result = await runLegalAgent({ question, context, orgId, userId, confidentialMode: effectiveConfidential }, access);
    // Validate payload at the boundary with a conservative schema
    const safePayload = IRACPayloadSchema.safeParse(result.payload);

    // Redact intermediate reasoning/tool logs from API responses to avoid chain-of-thought leakage.
    const redactedToolLogs: unknown[] = [];
    const redactedPlan: unknown[] = [];

    return {
      runId: result.runId,
      data: safePayload.success ? (safePayload.data as unknown as IRACPayload) : (result.payload as unknown as IRACPayload),
      toolLogs: redactedToolLogs,
      plan: redactedPlan,
      notices: result.notices ?? [],
      reused: Boolean(result.reused),
      verification: result.verification ?? null,
      trustPanel: result.trustPanel ?? null,
    };
  } catch (error) {
    request.log.error({ err: error }, 'agent execution failed');
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    return reply.code(502).send({
      error: 'agent_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.get<{ Querystring: { orgId?: string } }>(
  '/metrics/governance',
  {
    schema: {
      querystring: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const querySchema = z.object({ orgId: z.string().uuid() });
  const parsed = querySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
  }
  const { orgId } = parsed.data;

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    const [overviewResult, toolResult, provenanceResult, identifierResult, jurisdictionResult, manifestResult] = await Promise.all([
      supabase.from('org_metrics').select('*').eq('org_id', orgId).limit(1).maybeSingle(),
      supabase
        .from('tool_performance_metrics')
        .select('tool_name, total_invocations, success_count, failure_count, avg_latency_ms, p95_latency_ms, last_invoked_at')
        .eq('org_id', orgId)
        .order('tool_name', { ascending: true }),
      supabase.from('org_provenance_metrics').select('*').eq('org_id', orgId).limit(1).maybeSingle(),
      supabase
        .from('jurisdiction_identifier_coverage')
        .select('jurisdiction_code, sources_total, sources_with_eli, sources_with_ecli, sources_with_akoma, akoma_article_count')
        .eq('org_id', orgId)
        .order('jurisdiction_code', { ascending: true }),
      supabase
        .from('org_jurisdiction_provenance')
        .select(
          'jurisdiction_code, residency_zone, total_sources, sources_consolidated, sources_with_binding, sources_with_language_note, sources_with_eli, sources_with_ecli, sources_with_akoma, binding_breakdown, source_type_breakdown, language_note_breakdown',
        )
        .eq('org_id', orgId)
        .order('jurisdiction_code', { ascending: true }),
      supabase
        .from('drive_manifests')
        .select('manifest_name, manifest_url, file_count, valid_count, warning_count, error_count, validated, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (overviewResult.error) {
      request.log.error({ err: overviewResult.error }, 'org metrics query failed');
      return reply.code(500).send({ error: 'metrics_overview_failed' });
    }

    if (toolResult.error) {
      request.log.error({ err: toolResult.error }, 'tool metrics query failed');
      return reply.code(500).send({ error: 'metrics_tool_failed' });
    }

    if (provenanceResult.error) {
      request.log.error({ err: provenanceResult.error }, 'provenance metrics query failed');
      return reply.code(500).send({ error: 'metrics_provenance_failed' });
    }

    if (identifierResult.error) {
      request.log.error({ err: identifierResult.error }, 'identifier coverage query failed');
      return reply.code(500).send({ error: 'metrics_identifier_failed' });
    }

    if (jurisdictionResult.error) {
      request.log.error({ err: jurisdictionResult.error }, 'jurisdiction provenance query failed');
      return reply.code(500).send({ error: 'metrics_jurisdiction_provenance_failed' });
    }

    if (manifestResult.error) {
      request.log.error({ err: manifestResult.error }, 'drive manifest summary query failed');
      return reply.code(500).send({ error: 'metrics_manifest_failed' });
    }

    const overviewRow = overviewResult.data ?? null;
    const overview = overviewRow
      ? {
          orgId: overviewRow.org_id,
          orgName: overviewRow.name,
          totalRuns: overviewRow.total_runs ?? 0,
          runsLast30Days: overviewRow.runs_last_30_days ?? 0,
          highRiskRuns: overviewRow.high_risk_runs ?? 0,
          confidentialRuns: overviewRow.confidential_runs ?? 0,
          avgLatencyMs: toNumber(overviewRow.avg_latency_ms) ?? 0,
          allowlistedCitationRatio: toNumber(overviewRow.allowlisted_citation_ratio),
          hitlPending: overviewRow.hitl_pending ?? 0,
          hitlMedianResponseMinutes: toNumber(overviewRow.hitl_median_response_minutes),
          ingestionSuccessLast7Days: overviewRow.ingestion_success_last_7_days ?? 0,
          ingestionFailedLast7Days: overviewRow.ingestion_failed_last_7_days ?? 0,
          evaluationCases: overviewRow.evaluation_cases ?? 0,
          evaluationPassRate: toNumber(overviewRow.evaluation_pass_rate),
          documentsTotal: overviewRow.documents_total ?? 0,
          documentsReady: overviewRow.documents_ready ?? 0,
          documentsPending: overviewRow.documents_pending ?? 0,
          documentsFailed: overviewRow.documents_failed ?? 0,
          documentsSkipped: overviewRow.documents_skipped ?? 0,
          documentsChunked: overviewRow.documents_chunked ?? 0,
        }
      : null;

    const provenanceRow = provenanceResult.data ?? null;
    const provenance = provenanceRow
      ? {
          sourcesTotal: provenanceRow.total_sources ?? 0,
          sourcesWithBinding: provenanceRow.sources_with_binding ?? 0,
          sourcesWithLanguageNote: provenanceRow.sources_with_language_note ?? 0,
          sourcesWithEli: provenanceRow.sources_with_eli ?? 0,
          sourcesWithEcli: provenanceRow.sources_with_ecli ?? 0,
          sourcesWithResidency: provenanceRow.sources_with_residency ?? 0,
          linkOkRecent: provenanceRow.sources_link_ok_recent ?? 0,
          linkStale: provenanceRow.sources_link_stale ?? 0,
          linkFailed: provenanceRow.sources_link_failed ?? 0,
          bindingBreakdown: toNumberRecord(provenanceRow.binding_breakdown),
          residencyBreakdown: toNumberRecord(provenanceRow.residency_breakdown),
          chunkTotal: provenanceRow.chunk_total ?? 0,
          chunksWithMarkers: provenanceRow.chunks_with_markers ?? 0,
        }
      : null;

    const identifierRows = (identifierResult.data ?? []).map((row) => ({
      jurisdiction: row.jurisdiction_code ?? 'UNKNOWN',
      sourcesTotal: row.sources_total ?? 0,
      sourcesWithEli: row.sources_with_eli ?? 0,
      sourcesWithEcli: row.sources_with_ecli ?? 0,
      sourcesWithAkoma: row.sources_with_akoma ?? 0,
      akomaArticles: row.akoma_article_count ?? 0,
    }));

    const tools = (toolResult.data ?? []).map((row) => ({
      toolName: row.tool_name,
      totalInvocations: row.total_invocations ?? 0,
      successCount: row.success_count ?? 0,
      failureCount: row.failure_count ?? 0,
      avgLatencyMs: toNumber(row.avg_latency_ms) ?? 0,
      p95LatencyMs: toNumber(row.p95_latency_ms) ?? 0,
      lastInvokedAt: row.last_invoked_at ?? null,
    }));

    const jurisdictionRows = (jurisdictionResult.data ?? []).map((row) => ({
      jurisdiction: row.jurisdiction_code ?? 'UNKNOWN',
      residencyZone: row.residency_zone ?? 'unknown',
      totalSources: row.total_sources ?? 0,
      sourcesConsolidated: row.sources_consolidated ?? 0,
      sourcesWithBinding: row.sources_with_binding ?? 0,
      sourcesWithLanguageNote: row.sources_with_language_note ?? 0,
      sourcesWithEli: row.sources_with_eli ?? 0,
      sourcesWithEcli: row.sources_with_ecli ?? 0,
      sourcesWithAkoma: row.sources_with_akoma ?? 0,
      bindingBreakdown: toNumberRecord(row.binding_breakdown),
      sourceTypeBreakdown: toNumberRecord(row.source_type_breakdown),
      languageNoteBreakdown: toNumberRecord(row.language_note_breakdown),
    }));

    const manifestRow = manifestResult.data ?? null;
    const manifest = manifestRow
      ? (() => {
          const fileCount = (manifestRow as any).file_count ?? 0;
          const validCount = (manifestRow as any).valid_count ?? 0;
          const warningCount = (manifestRow as any).warning_count ?? 0;
          const errorCount = (manifestRow as any).error_count ?? 0;
          const validated = Boolean((manifestRow as any).validated);
          let status: 'ok' | 'warnings' | 'errors' = 'ok';
          if (errorCount > 0) status = 'errors';
          else if (warningCount > 0) status = 'warnings';
          else status = 'ok';
          return {
            manifestName: (manifestRow as any).manifest_name ?? null,
            manifestUrl: (manifestRow as any).manifest_url ?? null,
            fileCount,
            validCount,
            warningCount,
            errorCount,
            validated,
            createdAt: (manifestRow as any).created_at ?? null,
            status,
          };
        })()
      : null;

    return { overview, provenance, tools, identifiers: identifierRows, jurisdictions: jurisdictionRows, manifest };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'governance metrics failed');
    return reply.code(500).send({ error: 'metrics_failed' });
  }
  },
);

app.get<{ Querystring: { status?: string; category?: string; orgId?: string } }>('/governance/publications', async (request, reply) => {
  const { status, category, orgId } = request.query ?? {};

  if (orgId) {
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'publications authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }
  }

  let query = supabase
    .from('governance_publications')
    .select('slug, title, summary, doc_url, category, status, published_at, metadata')
    .order('published_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  } else {
    query = query.eq('status', 'published');
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'governance publications query failed');
    return reply.code(500).send({ error: 'publications_failed' });
  }

  return { publications: data ?? [] };
});

app.get<{ Querystring: { orgId?: string } }>(
  '/metrics/retrieval',
  {
    schema: {
      querystring: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    const [summaryResult, originResult, hostResult] = await Promise.all([
      supabase
        .from('org_retrieval_metrics')
        .select('*')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('org_retrieval_origin_metrics')
        .select('origin, snippet_count, avg_similarity, avg_weight')
        .eq('org_id', orgId),
      supabase
        .from('org_retrieval_host_metrics')
        .select('host, citation_count, allowlisted_count, translation_warnings, last_cited_at')
        .eq('org_id', orgId)
        .order('citation_count', { ascending: false })
        .limit(15),
    ]);

    if (summaryResult.error) {
      request.log.error({ err: summaryResult.error }, 'retrieval summary query failed');
      return reply.code(500).send({ error: 'metrics_retrieval_summary_failed' });
    }

    if (originResult.error) {
      request.log.error({ err: originResult.error }, 'retrieval origin query failed');
      return reply.code(500).send({ error: 'metrics_retrieval_origin_failed' });
    }

    if (hostResult.error) {
      request.log.error({ err: hostResult.error }, 'retrieval host query failed');
      return reply.code(500).send({ error: 'metrics_retrieval_host_failed' });
    }

    return buildRetrievalMetricsResponse(
      (summaryResult.data ?? null) as RetrievalSummaryRow | null,
      (originResult.data ?? []) as RetrievalOriginRow[],
      (hostResult.data ?? []) as RetrievalHostRow[],
    );
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'retrieval metrics authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }
  },
);

app.get<{ Querystring: { orgId?: string } }>(
  '/metrics/evaluations',
  {
    schema: {
      querystring: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    const [summaryResult, jurisdictionResult] = await Promise.all([
      supabase
        .from('org_evaluation_metrics')
        .select('*')
        .eq('org_id', orgId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('org_evaluation_jurisdiction_metrics')
        .select(
          'jurisdiction, evaluation_count, pass_rate, citation_precision_median, temporal_validity_median, avg_binding_warnings, maghreb_banner_coverage',
        )
        .eq('org_id', orgId),
    ]);

    if (summaryResult.error) {
      request.log.error({ err: summaryResult.error }, 'evaluation summary query failed');
      return reply.code(500).send({ error: 'metrics_evaluation_summary_failed' });
    }

    if (jurisdictionResult.error) {
      request.log.error({ err: jurisdictionResult.error }, 'evaluation jurisdiction query failed');
      return reply.code(500).send({ error: 'metrics_evaluation_jurisdiction_failed' });
    }

    return buildEvaluationMetricsResponse(
      (summaryResult.data ?? null) as EvaluationMetricsSummaryRow | null,
      (jurisdictionResult.data ?? []) as EvaluationJurisdictionRow[],
    );
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'evaluation metrics authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }
  },
);

app.get<{ Querystring: { orgId?: string; start?: string; end?: string } }>(
  '/metrics/cepej',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: { orgId: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' } },
        required: ['orgId'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId, start, end } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let range: { start: string; end: string };
  try {
    range = resolveDateRange(start, end);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid_date_range' });
  }

  try {
    await authorizeRequestWithGuards('governance:cepej', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('compliance_assessments')
      .select('cepej_passed, cepej_violations, fria_required, created_at')
      .eq('org_id', orgId)
      .gte('created_at', range.start)
      .lte('created_at', range.end);

    if (error) {
      request.log.error({ err: error }, 'cepej metrics query failed');
      return reply.code(500).send({ error: 'cepej_metrics_failed' });
    }

    const summary = summariseCepej((data ?? []) as CepejRecord[]);
    return { timeframe: range, summary };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'cepej metrics failed');
    return reply.code(500).send({ error: 'cepej_metrics_failed' });
  }
  },
);

app.get<{ Querystring: { orgId?: string; start?: string; end?: string; format?: string } }>(
  '/metrics/cepej/export',
  async (request, reply) => {
    const { orgId, start, end, format } = request.query;
    if (!orgId) {
      return reply.code(400).send({ error: 'orgId is required' });
    }

    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    let range: { start: string; end: string };
    try {
      range = resolveDateRange(start, end);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid_date_range' });
    }

    try {
      await authorizeRequestWithGuards('governance:cepej', orgId, userHeader, request);
      const { data, error } = await supabase
        .from('compliance_assessments')
        .select('cepej_passed, cepej_violations, fria_required, created_at')
        .eq('org_id', orgId)
        .gte('created_at', range.start)
        .lte('created_at', range.end);

      if (error) {
        request.log.error({ err: error }, 'cepej export query failed');
        return reply.code(500).send({ error: 'cepej_export_failed' });
      }

      const summary = summariseCepej((data ?? []) as CepejRecord[]);
      if ((format ?? 'json').toLowerCase() === 'csv') {
        const rows: Array<[string, string | number | null]> = [
          ['org_id', orgId],
          ['timeframe_start', range.start],
          ['timeframe_end', range.end],
          ['assessed_runs', summary.assessedRuns],
          ['passed_runs', summary.passedRuns],
          ['violation_runs', summary.violationRuns],
          ['fria_required_runs', summary.friaRequiredRuns],
          ['pass_rate', summary.passRate ?? ''],
        ];
        for (const [violation, count] of Object.entries(summary.violations)) {
          rows.push([`violation_${violation}`, count]);
        }
        const csv = rows
          .map(([key, value]) => `${key},${value === null ? '' : String(value).replace(/"/g, '""')}`)
          .join('\n');
        reply.header('content-type', 'text/csv; charset=utf-8');
        reply.header('content-disposition', `attachment; filename="cepej-${orgId}.csv"`);
        return csv;
      }

      return { timeframe: range, summary };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'cepej export failed');
      return reply.code(500).send({ error: 'cepej_export_failed' });
    }
  },
);

app.post<{
  Body: { orgId?: string; periodStart?: string; periodEnd?: string; dryRun?: boolean };
}>('/reports/transparency', async (request, reply) => {
  const bodySchema = z.object({
    orgId: z.string().uuid(),
    periodStart: z.string().datetime().optional(),
    periodEnd: z.string().datetime().optional(),
    dryRun: z.coerce.boolean().optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { orgId, periodStart, periodEnd, dryRun } = parsed.data;

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let range: { start: string; end: string };
  try {
    range = resolveDateRange(periodStart, periodEnd);
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid_date_range' });
  }

  try {
    await authorizeRequestWithGuards('governance:transparency', orgId, userHeader, request);

    const [orgResult, runResult, hitlResult, ingestionResult, casesResult, cepejResult] = await Promise.all([
      supabase.from('organizations').select('id, name').eq('id', orgId).maybeSingle(),
      supabase
        .from('agent_runs')
        .select('risk_level, hitl_required, started_at, finished_at, confidential_mode')
        .eq('org_id', orgId)
        .gte('started_at', range.start)
        .lte('started_at', range.end),
      supabase
        .from('hitl_queue')
        .select('status, created_at, updated_at')
        .eq('org_id', orgId)
        .gte('created_at', range.start)
        .lte('created_at', range.end),
      supabase
        .from('ingestion_runs')
        .select('status, started_at, inserted_count, failed_count')
        .eq('org_id', orgId)
        .gte('started_at', range.start)
        .lte('started_at', range.end),
      supabase.from('eval_cases').select('id').eq('org_id', orgId),
      supabase
        .from('compliance_assessments')
        .select('cepej_passed, cepej_violations, fria_required, created_at')
        .eq('org_id', orgId)
        .gte('created_at', range.start)
        .lte('created_at', range.end),
    ]);

    if (orgResult.error) {
      request.log.error({ err: orgResult.error }, 'transparency org lookup failed');
      return reply.code(500).send({ error: 'transparency_org_failed' });
    }
    if (!orgResult.data) {
      return reply.code(404).send({ error: 'organisation_not_found' });
    }

    const caseIds = (casesResult.data ?? []).map((row) => row.id);
    let evaluationRows: EvaluationRecord[] = [];
    if (caseIds.length > 0) {
      const evalResult = await supabase
        .from('eval_results')
        .select('pass, created_at, case_id')
        .in('case_id', caseIds)
        .gte('created_at', range.start)
        .lte('created_at', range.end);
      if (evalResult.error) {
        request.log.error({ err: evalResult.error }, 'transparency eval lookup failed');
        return reply.code(500).send({ error: 'transparency_eval_failed' });
      }
      evaluationRows = (evalResult.data ?? []) as unknown as EvaluationRecord[];
    }

    if (runResult.error) {
      request.log.error({ err: runResult.error }, 'transparency run query failed');
      return reply.code(500).send({ error: 'transparency_run_failed' });
    }
    if (hitlResult.error) {
      request.log.error({ err: hitlResult.error }, 'transparency hitl query failed');
      return reply.code(500).send({ error: 'transparency_hitl_failed' });
    }
    if (ingestionResult.error) {
      request.log.error({ err: ingestionResult.error }, 'transparency ingestion query failed');
      return reply.code(500).send({ error: 'transparency_ingestion_failed' });
    }
    if (cepejResult.error) {
      request.log.error({ err: cepejResult.error }, 'transparency cepej query failed');
      return reply.code(500).send({ error: 'transparency_cepej_failed' });
    }
    if (casesResult.error) {
      request.log.error({ err: casesResult.error }, 'transparency eval cases query failed');
      return reply.code(500).send({ error: 'transparency_cases_failed' });
    }

    const runSummary = summariseRuns((runResult.data ?? []) as unknown as RunRecord[]);
    const hitlSummary = summariseHitl((hitlResult.data ?? []) as unknown as HitlRecord[]);
    const ingestionSummary = summariseIngestion((ingestionResult.data ?? []) as unknown as IngestionRecord[]);
    const evaluationSummary = summariseEvaluations(evaluationRows);
    const cepejSummary = summariseCepej((cepejResult.data ?? []) as unknown as CepejRecord[]);

    const payload = buildTransparencyReport({
      organisation: { id: orgResult.data.id, name: orgResult.data.name },
      timeframe: range,
      runs: runSummary,
      hitl: hitlSummary,
      ingestion: ingestionSummary,
      evaluations: evaluationSummary,
      cepej: cepejSummary,
    });

    if (dryRun) {
      return { dryRun: true, report: payload };
    }

    const periodStartDate = new Date(range.start).toISOString().slice(0, 10);
    const periodEndDate = new Date(range.end).toISOString().slice(0, 10);
    const insertResult = await supabase
      .from('transparency_reports')
      .insert({
        org_id: orgId,
        generated_by: userHeader,
        period_start: periodStartDate,
        period_end: periodEndDate,
        metrics: payload,
        cepej_summary: cepejSummary,
      })
      .select('id, org_id, period_start, period_end, generated_at, distribution_status, metrics, cepej_summary')
      .single();

    if (insertResult.error || !insertResult.data) {
      request.log.error({ err: insertResult.error }, 'transparency insert failed');
      return reply.code(500).send({ error: 'transparency_insert_failed' });
    }

    return reply.code(201).send({ report: insertResult.data });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'transparency generation failed');
    return reply.code(500).send({ error: 'transparency_failed' });
  }
});

app.get<{ Querystring: { orgId?: string; limit?: string } }>('/reports/transparency', async (request, reply) => {
  const { orgId } = request.query;
  const limitParam = request.query.limit ? Number.parseInt(request.query.limit, 10) : 20;
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('governance:transparency', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('transparency_reports')
      .select('id, org_id, period_start, period_end, generated_at, distribution_status, metrics, cepej_summary')
      .eq('org_id', orgId)
      .order('period_end', { ascending: false })
      .limit(limit);

    if (error) {
      request.log.error({ err: error }, 'transparency list failed');
      return reply.code(500).send({ error: 'transparency_list_failed' });
    }

    return { reports: data ?? [] };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'transparency list auth failed');
    return reply.code(500).send({ error: 'transparency_list_failed' });
  }
});

app.get<{ Params: { reportId: string } }>('/reports/transparency/:reportId', async (request, reply) => {
  const { reportId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { data, error } = await supabase
    .from('transparency_reports')
    .select('id, org_id, period_start, period_end, generated_at, distribution_status, metrics, cepej_summary')
    .eq('id', reportId)
    .maybeSingle();

  if (error) {
    request.log.error({ err: error }, 'transparency fetch failed');
    return reply.code(500).send({ error: 'transparency_fetch_failed' });
  }

  if (!data) {
    return reply.code(404).send({ error: 'report_not_found' });
  }

  try {
    await authorizeRequestWithGuards('governance:transparency', data.org_id as string, userHeader, request);
    return { report: data };
  } catch (authError) {
    if (authError instanceof Error && 'statusCode' in authError && typeof authError.statusCode === 'number') {
      return reply.code(authError.statusCode).send({ error: authError.message });
    }
    request.log.error({ err: authError }, 'transparency fetch auth failed');
    return reply.code(500).send({ error: 'transparency_fetch_failed' });
  }
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/red-team', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('governance:red-team', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('red_team_findings')
      .select(
        'id, scenario_key, severity, expected_outcome, observed_outcome, passed, summary, detail, mitigations, status, detected_at, resolved_at, resolved_by, created_by, updated_at',
      )
      .eq('org_id', orgId)
      .order('detected_at', { ascending: false });

    if (error) {
      request.log.error({ err: error }, 'red team fetch failed');
      return reply.code(500).send({ error: 'red_team_fetch_failed' });
    }

    return {
      findings: (data ?? []).map((row) => ({
        id: row.id,
        scenarioKey: row.scenario_key,
        severity: row.severity,
        expectedOutcome: row.expected_outcome,
        observedOutcome: row.observed_outcome,
        passed: row.passed,
        summary: row.summary,
        detail: row.detail ?? null,
        mitigations: row.mitigations ?? null,
        status: row.status,
        detectedAt: row.detected_at,
        resolvedAt: row.resolved_at ?? null,
        resolvedBy: row.resolved_by ?? null,
        createdBy: row.created_by,
        updatedAt: row.updated_at,
      })),
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'red team list failed');
    return reply.code(500).send({ error: 'red_team_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: {
    scenarioKey: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    expectedOutcome: string;
    observedOutcome: string;
    passed: boolean;
    summary: string;
    detail?: Record<string, unknown>;
    mitigations?: string | null;
    status?: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
    detectedAt?: string;
  };
}>('/admin/org/:orgId/red-team', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const bodySchema = z.object({
    scenarioKey: z.string().min(1),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    expectedOutcome: z.string().min(1),
    observedOutcome: z.string().min(1),
    passed: z.coerce.boolean(),
    summary: z.string().min(1),
    detail: z.record(z.any()).optional(),
    mitigations: z.string().nullable().optional(),
    status: z.enum(['open', 'in_progress', 'resolved', 'accepted_risk']).optional(),
    detectedAt: z.string().datetime().optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { scenarioKey, severity, expectedOutcome, observedOutcome, passed, summary, detail, mitigations, status, detectedAt } = parsed.data;

  try {
    await authorizeRequestWithGuards('governance:red-team', orgId, userHeader, request);

    const effectiveStatus = status ?? (passed ? 'resolved' : 'open');
    const payload = {
      org_id: orgId,
      scenario_key: scenarioKey,
      severity,
      expected_outcome: expectedOutcome,
      observed_outcome: observedOutcome,
      passed,
      summary,
      detail: detail ?? null,
      mitigations: mitigations ?? null,
      status: effectiveStatus,
      detected_at: detectedAt ?? new Date().toISOString(),
      resolved_at: effectiveStatus === 'resolved' || effectiveStatus === 'accepted_risk' ? new Date().toISOString() : null,
      resolved_by: effectiveStatus === 'resolved' || effectiveStatus === 'accepted_risk' ? userHeader : null,
      created_by: userHeader,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('red_team_findings')
      .insert(payload)
      .select('id, scenario_key, severity, expected_outcome, observed_outcome, passed, summary, detail, mitigations, status, detected_at, resolved_at, resolved_by, created_by, updated_at')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'red team insert failed');
      return reply.code(500).send({ error: 'red_team_insert_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'red_team.recorded',
      object: scenarioKey,
      after: payload,
    });

    return {
      finding: data,
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'red team create failed');
    return reply.code(500).send({ error: 'red_team_failed' });
  }
});

app.patch<{
  Params: { orgId: string; findingId: string };
  Body: {
    status?: 'open' | 'in_progress' | 'resolved' | 'accepted_risk';
    mitigations?: string | null;
    resolvedAt?: string | null;
    observedOutcome?: string;
    passed?: boolean;
  };
}>('/admin/org/:orgId/red-team/:findingId', async (request, reply) => {
  const { orgId, findingId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const bodySchema = z.object({
    status: z.enum(['open', 'in_progress', 'resolved', 'accepted_risk']).optional(),
    mitigations: z.string().nullable().optional(),
    resolvedAt: z.string().datetime().nullable().optional(),
    observedOutcome: z.string().min(1).optional(),
    passed: z.coerce.boolean().optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { status, mitigations, resolvedAt, observedOutcome, passed } = parsed.data;

  try {
    await authorizeRequestWithGuards('governance:red-team', orgId, userHeader, request);

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (status) {
      updatePayload.status = status;
      if (status === 'resolved' || status === 'accepted_risk') {
        updatePayload.resolved_at = resolvedAt ?? new Date().toISOString();
        updatePayload.resolved_by = userHeader;
      }
    }

    if (mitigations !== undefined) {
      updatePayload.mitigations = mitigations;
    }

    if (observedOutcome) {
      updatePayload.observed_outcome = observedOutcome;
    }

    if (passed !== undefined) {
      updatePayload.passed = passed;
    }

    if (resolvedAt === null) {
      updatePayload.resolved_at = null;
      updatePayload.resolved_by = null;
    }

    const { data, error } = await supabase
      .from('red_team_findings')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', findingId)
      .select('id, scenario_key, severity, expected_outcome, observed_outcome, passed, summary, detail, mitigations, status, detected_at, resolved_at, resolved_by, created_by, updated_at')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'red team update failed');
      return reply.code(500).send({ error: 'red_team_update_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'red_team.updated',
      object: findingId,
      after: updatePayload,
    });

    return { finding: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'red team patch failed');
    return reply.code(500).send({ error: 'red_team_failed' });
  }
});

app.get<{ Params: { orgId: string } }>(
  '/admin/org/:orgId/go-no-go/fria',
  async (request, reply) => {
    const { orgId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
      const { data, error } = await supabase
        .from('fria_artifacts')
        .select(
          'id, release_tag, title, evidence_url, storage_path, hash_sha256, validated, submitted_by, submitted_at, notes',
        )
        .eq('org_id', orgId)
        .order('submitted_at', { ascending: false });

      if (error) {
        request.log.error({ err: error }, 'fria artifact fetch failed');
        return reply.code(500).send({ error: 'fria_artifact_failed' });
      }

      return {
        artifacts: (data ?? []).map((row) => ({
          id: row.id,
          releaseTag: row.release_tag ?? null,
          title: row.title,
          evidenceUrl: row.evidence_url ?? null,
          storagePath: row.storage_path ?? null,
          hashSha256: row.hash_sha256 ?? null,
          validated: row.validated ?? false,
          submittedBy: row.submitted_by,
          submittedAt: row.submitted_at,
          notes: row.notes ?? null,
        })),
      };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'fria artifact auth failed');
      return reply.code(500).send({ error: 'fria_artifact_failed' });
    }
  },
);

app.post<{
  Params: { orgId: string };
  Body: {
    releaseTag?: string | null;
    title: string;
    evidenceUrl?: string | null;
    storagePath?: string | null;
    hashSha256?: string | null;
    validated?: boolean;
    notes?: unknown;
  };
}>('/admin/org/:orgId/go-no-go/fria', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { releaseTag, title, evidenceUrl, storagePath, hashSha256, validated, notes } = request.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return reply.code(400).send({ error: 'missing_title' });
  }

  if (!evidenceUrl && !storagePath) {
    return reply.code(400).send({ error: 'missing_artifact_reference' });
  }

  let parsedNotes: Record<string, unknown> | null | undefined;
  try {
    parsedNotes = parseEvidenceNotes(notes);
  } catch (error) {
    return reply.code(400).send({ error: 'invalid_notes' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
    const insertPayload = {
      org_id: orgId,
      release_tag: releaseTag && typeof releaseTag === 'string' ? releaseTag.trim() || null : null,
      title: title.trim(),
      evidence_url: evidenceUrl && typeof evidenceUrl === 'string' ? evidenceUrl.trim() || null : null,
      storage_path: storagePath && typeof storagePath === 'string' ? storagePath.trim() || null : null,
      hash_sha256: hashSha256 && typeof hashSha256 === 'string' ? hashSha256.trim() || null : null,
      validated: Boolean(validated),
      submitted_by: userHeader,
      submitted_at: new Date().toISOString(),
      notes: parsedNotes ?? null,
    };

    const { data, error } = await supabase
      .from('fria_artifacts')
      .insert(insertPayload)
      .select(
        'id, release_tag, title, evidence_url, storage_path, hash_sha256, validated, submitted_by, submitted_at, notes',
      )
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'fria artifact insert failed');
      return reply.code(500).send({ error: 'fria_artifact_failed' });
    }

    await refreshFriaEvidence(orgId, userHeader);

    const artifactId = data?.id ?? 'fria:unknown';

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.fria_recorded',
      object: artifactId,
      after: insertPayload,
    });

    return { artifact: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'fria artifact create failed');
    return reply.code(500).send({ error: 'fria_artifact_failed' });
  }
});

app.patch<{
  Params: { orgId: string; artifactId: string };
  Body: {
    releaseTag?: string | null;
    title?: string;
    evidenceUrl?: string | null;
    storagePath?: string | null;
    hashSha256?: string | null;
    validated?: boolean;
    notes?: unknown;
  };
}>('/admin/org/:orgId/go-no-go/fria/:artifactId', async (request, reply) => {
  const { orgId, artifactId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { releaseTag, title, evidenceUrl, storagePath, hashSha256, validated, notes } = request.body;

  let parsedNotes: Record<string, unknown> | null | undefined;
  try {
    parsedNotes = parseEvidenceNotes(notes);
  } catch (error) {
    return reply.code(400).send({ error: 'invalid_notes' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
    const { data: existing, error: fetchError } = await supabase
      .from('fria_artifacts')
      .select('id, org_id')
      .eq('id', artifactId)
      .maybeSingle();

    if (fetchError) {
      request.log.error({ err: fetchError }, 'fria artifact fetch failed');
      return reply.code(500).send({ error: 'fria_artifact_failed' });
    }

    if (!existing || existing.org_id !== orgId) {
      return reply.code(404).send({ error: 'fria_artifact_not_found' });
    }

    const updatePayload: Record<string, unknown> = {};
    if (releaseTag !== undefined) {
      updatePayload.release_tag = releaseTag && typeof releaseTag === 'string' ? releaseTag.trim() || null : null;
    }
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return reply.code(400).send({ error: 'invalid_title' });
      }
      updatePayload.title = title.trim();
    }
    if (evidenceUrl !== undefined) {
      updatePayload.evidence_url = evidenceUrl && typeof evidenceUrl === 'string' ? evidenceUrl.trim() || null : null;
    }
    if (storagePath !== undefined) {
      updatePayload.storage_path = storagePath && typeof storagePath === 'string' ? storagePath.trim() || null : null;
    }
    if (hashSha256 !== undefined) {
      updatePayload.hash_sha256 = hashSha256 && typeof hashSha256 === 'string' ? hashSha256.trim() || null : null;
    }
    if (validated !== undefined) {
      updatePayload.validated = Boolean(validated);
    }
    if (parsedNotes !== undefined) {
      updatePayload.notes = parsedNotes;
    }

    if (Object.keys(updatePayload).length === 0) {
      return reply.code(400).send({ error: 'no_updates_supplied' });
    }

    const { data, error } = await supabase
      .from('fria_artifacts')
      .update(updatePayload)
      .eq('id', artifactId)
      .select(
        'id, release_tag, title, evidence_url, storage_path, hash_sha256, validated, submitted_by, submitted_at, notes',
      )
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'fria artifact update failed');
      return reply.code(500).send({ error: 'fria_artifact_failed' });
    }

    await refreshFriaEvidence(orgId, userHeader);

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.fria_updated',
      object: artifactId,
      after: updatePayload,
    });

    return { artifact: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'fria artifact patch failed');
    return reply.code(500).send({ error: 'fria_artifact_failed' });
  }
});

app.get<{ Params: { orgId: string }; Querystring: { section?: string; status?: string } }>(
  '/admin/org/:orgId/go-no-go/evidence',
  async (request, reply) => {
    const { orgId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    const sectionFilter = request.query.section?.toUpperCase();
    const statusFilter = request.query.status?.toLowerCase();

    if (sectionFilter && !GO_NO_GO_SECTIONS.has(sectionFilter)) {
      return reply.code(400).send({ error: 'invalid_section' });
    }

    if (statusFilter && !GO_NO_GO_STATUSES.has(statusFilter)) {
      return reply.code(400).send({ error: 'invalid_status' });
    }

    try {
      await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
      let query = supabase
        .from('go_no_go_evidence')
        .select('id, section, criterion, status, evidence_url, notes, recorded_by, recorded_at')
        .eq('org_id', orgId)
        .order('section', { ascending: true })
        .order('recorded_at', { ascending: false });

      if (sectionFilter) {
        query = query.eq('section', sectionFilter);
      }
      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        request.log.error({ err: error }, 'go-no-go evidence fetch failed');
        return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
      }

      return {
        evidence: (data ?? []).map((row) => ({
          id: row.id,
          section: row.section,
          criterion: row.criterion,
          status: row.status,
          evidenceUrl: row.evidence_url ?? null,
          notes: row.notes ?? null,
          recordedBy: row.recorded_by,
          recordedAt: row.recorded_at,
        })),
      };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'go-no-go evidence auth failed');
      return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
    }
  },
);

app.post<{
  Params: { orgId: string };
  Body: {
    section: string;
    criterion: string;
    status?: 'pending' | 'satisfied';
    evidenceUrl?: string | null;
    notes?: unknown;
  };
}>('/admin/org/:orgId/go-no-go/evidence', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const bodySchema = z.object({
    section: z.string().min(1),
    criterion: z.string().min(1),
    status: z.enum(['pending', 'satisfied']).optional(),
    evidenceUrl: z.string().url().nullable().optional(),
    notes: z.record(z.any()).optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { section, criterion, status, evidenceUrl, notes } = parsed.data as {
    section: string;
    criterion: string;
    status?: 'pending' | 'satisfied';
    evidenceUrl?: string | null;
    notes?: Record<string, unknown>;
  };

  const normalizedSection = section.toUpperCase();
  if (!GO_NO_GO_SECTIONS.has(normalizedSection)) {
    return reply.code(400).send({ error: 'invalid_section' });
  }

  const normalizedStatus = (status ?? 'pending').toLowerCase();
  if (!GO_NO_GO_STATUSES.has(normalizedStatus)) {
    return reply.code(400).send({ error: 'invalid_status' });
  }

  let parsedNotes: Record<string, unknown> | null | undefined;
  try {
    parsedNotes = parseEvidenceNotes(notes);
  } catch (error) {
    return reply.code(400).send({ error: 'invalid_notes' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
    const payload = {
      org_id: orgId,
      section: normalizedSection,
      criterion: criterion.trim(),
      status: normalizedStatus,
      evidence_url: evidenceUrl ?? null,
      notes: parsedNotes ?? null,
      recorded_by: userHeader,
    };

    const { data, error } = await supabase
      .from('go_no_go_evidence')
      .insert(payload)
      .select('id, section, criterion, status, evidence_url, notes, recorded_by, recorded_at')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'go-no-go evidence insert failed');
      return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.evidence_recorded',
      object: `${normalizedSection}:${criterion.trim()}`,
      after: payload,
    });

    return {
      evidence: data,
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'go-no-go evidence create failed');
    return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
  }
});

app.patch<{
  Params: { orgId: string; evidenceId: string };
  Body: {
    status?: 'pending' | 'satisfied';
    evidenceUrl?: string | null;
    notes?: unknown;
  };
}>('/admin/org/:orgId/go-no-go/evidence/:evidenceId', async (request, reply) => {
  const { orgId, evidenceId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  if (
    request.body.status === undefined &&
    request.body.evidenceUrl === undefined &&
    request.body.notes === undefined
  ) {
    return reply.code(400).send({ error: 'nothing_to_update' });
  }

  const nextStatus = request.body.status ? request.body.status.toLowerCase() : undefined;
  if (nextStatus && !GO_NO_GO_STATUSES.has(nextStatus)) {
    return reply.code(400).send({ error: 'invalid_status' });
  }

  let parsedNotes: Record<string, unknown> | null | undefined;
  try {
    parsedNotes = parseEvidenceNotes(request.body.notes);
  } catch (error) {
    return reply.code(400).send({ error: 'invalid_notes' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);

    const { data: current, error: currentError } = await supabase
      .from('go_no_go_evidence')
      .select('id, section, criterion, status, evidence_url, notes, recorded_by, recorded_at')
      .eq('org_id', orgId)
      .eq('id', evidenceId)
      .maybeSingle();

    if (currentError) {
      request.log.error({ err: currentError }, 'go-no-go evidence fetch failed');
      return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
    }

    if (!current) {
      return reply.code(404).send({ error: 'evidence_not_found' });
    }

    const updatePayload: Record<string, unknown> = {};
    if (nextStatus) {
      updatePayload.status = nextStatus;
    }
    if (request.body.evidenceUrl !== undefined) {
      updatePayload.evidence_url = request.body.evidenceUrl ?? null;
    }
    if (parsedNotes !== undefined) {
      updatePayload.notes = parsedNotes ?? null;
    }

    const { data, error } = await supabase
      .from('go_no_go_evidence')
      .update(updatePayload)
      .eq('org_id', orgId)
      .eq('id', evidenceId)
      .select('id, section, criterion, status, evidence_url, notes, recorded_by, recorded_at')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'go-no-go evidence update failed');
      return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.evidence_updated',
      object: evidenceId,
      before: current,
      after: { ...current, ...updatePayload },
    });

    return { evidence: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'go-no-go evidence patch failed');
    return reply.code(500).send({ error: 'go_no_go_evidence_failed' });
  }
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/go-no-go/signoffs', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('go_no_go_signoffs')
      .select('id, release_tag, decision, decided_by, decided_at, notes, evidence_total')
      .eq('org_id', orgId)
      .order('decided_at', { ascending: false });

    if (error) {
      request.log.error({ err: error }, 'go-no-go signoff fetch failed');
      return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
    }

    return { signoffs: data ?? [] };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'go-no-go signoff auth failed');
    return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: { releaseTag: string; decision: 'go' | 'no-go'; notes?: string | null };
}>('/admin/org/:orgId/go-no-go/signoffs', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const bodySchema = z.object({
    releaseTag: z.string().min(1),
    decision: z.enum(['go', 'no-go']),
    notes: z.string().nullable().optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { releaseTag, decision, notes } = parsed.data;

  const normalizedDecision = decision.toLowerCase();
  if (!GO_NO_GO_DECISIONS.has(normalizedDecision)) {
    return reply.code(400).send({ error: 'invalid_decision' });
  }

  try {
    await authorizeRequestWithGuards('governance:go-no-go-signoff', orgId, userHeader, request);

    const { count: satisfiedCount, error: countError } = await supabase
      .from('go_no_go_evidence')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'satisfied');

    if (countError) {
      request.log.error({ err: countError }, 'go-no-go evidence count failed');
      return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
    }

    const signoffPayload = {
      org_id: orgId,
      release_tag: releaseTag.trim(),
      decision: normalizedDecision,
      decided_by: userHeader,
      decided_at: new Date().toISOString(),
      notes: notes ?? null,
      evidence_total: satisfiedCount ?? 0,
    };

    const { data, error } = await supabase
      .from('go_no_go_signoffs')
      .upsert(signoffPayload, { onConflict: 'org_id,release_tag' })
      .select('id, release_tag, decision, decided_by, decided_at, notes, evidence_total')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'go-no-go signoff failed');
      return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'go_no_go.signoff_recorded',
      object: releaseTag.trim(),
      after: signoffPayload,
    });

    return { signoff: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'go-no-go signoff create failed');
    return reply.code(500).send({ error: 'go_no_go_signoff_failed' });
  }
});

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/performance/snapshots', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('performance_snapshots')
      .select('id, window_label, collected_at, total_runs, avg_latency_ms, p95_latency_ms, allowlisted_ratio, hitl_median_minutes, citation_precision, temporal_validity, binding_warnings, notes, recorded_by, metadata')
      .eq('org_id', orgId)
      .order('collected_at', { ascending: false });

    if (error) {
      request.log.error({ err: error }, 'performance snapshot fetch failed');
      return reply.code(500).send({ error: 'performance_snapshot_fetch_failed' });
    }

    return {
      snapshots: data ?? [],
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'performance snapshot list failed');
    return reply.code(500).send({ error: 'performance_snapshot_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: {
    windowLabel: string;
    totalRuns?: number;
    avgLatencyMs?: number | null;
    p95LatencyMs?: number | null;
    allowlistedRatio?: number | null;
    hitlMedianMinutes?: number | null;
    citationPrecision?: number | null;
    temporalValidity?: number | null;
    bindingWarnings?: number | null;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  };
}>('/admin/org/:orgId/performance/snapshots', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const { windowLabel } = request.body;
  if (!windowLabel) {
    return reply.code(400).send({ error: 'windowLabel is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:baseline', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('performance_snapshots')
      .insert({
        org_id: orgId,
        window_label: windowLabel,
        total_runs: request.body.totalRuns ?? 0,
        avg_latency_ms: request.body.avgLatencyMs ?? null,
        p95_latency_ms: request.body.p95LatencyMs ?? null,
        allowlisted_ratio: request.body.allowlistedRatio ?? null,
        hitl_median_minutes: request.body.hitlMedianMinutes ?? null,
        citation_precision: request.body.citationPrecision ?? null,
        temporal_validity: request.body.temporalValidity ?? null,
        binding_warnings: request.body.bindingWarnings ?? null,
        notes: request.body.notes ?? null,
        recorded_by: userHeader,
        metadata: request.body.metadata ?? null,
      })
      .select('id, window_label, collected_at, total_runs, avg_latency_ms, p95_latency_ms, allowlisted_ratio, hitl_median_minutes, citation_precision, temporal_validity, binding_warnings, notes, recorded_by, metadata')
      .maybeSingle();

    if (error) {
      request.log.error({ err: error }, 'performance snapshot insert failed');
      return reply.code(500).send({ error: 'performance_snapshot_insert_failed' });
    }

    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'performance.snapshot_recorded',
      object: windowLabel,
      after: data ?? null,
    });

    return { snapshot: data };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'performance snapshot create failed');
    return reply.code(500).send({ error: 'performance_snapshot_failed' });
  }
});

app.get<{ Params: { orgId: string } }>(
  '/admin/org/:orgId/sso',
  {
    schema: {
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    const connections = await listSsoConnections(orgId);
    return { connections };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'sso list failed');
    return reply.code(500).send({ error: 'sso_list_failed' });
  }
  },
);

app.post<{
  Params: { orgId: string };
  Body: {
    id?: string;
    provider: 'saml' | 'oidc';
    label?: string;
    metadata?: Record<string, unknown>;
    acsUrl?: string;
    entityId?: string;
    clientId?: string;
    clientSecret?: string;
    defaultRole?: string;
    groupMappings?: Record<string, string>;
  };
}>(
  '/admin/org/:orgId/sso',
  {
    schema: {
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
      body: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          provider: { type: 'string', enum: ['saml', 'oidc'] },
          label: { type: 'string' },
          metadata: { type: 'object' },
          acsUrl: { type: 'string' },
          entityId: { type: 'string' },
          clientId: { type: 'string' },
          clientSecret: { type: 'string' },
          defaultRole: { type: 'string' },
          groupMappings: { type: 'object' },
        },
        required: ['provider'],
        additionalProperties: true,
      },
    },
  },
  async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  const bodySchema = z.object({
    id: z.string().uuid().optional(),
    provider: z.enum(['saml', 'oidc']),
    label: z.string().max(200).optional(),
    metadata: z.record(z.any()).optional(),
    acsUrl: z.string().url().optional(),
    entityId: z.string().min(1).optional(),
    clientId: z.string().min(1).optional(),
    clientSecret: z.string().min(1).optional(),
    defaultRole: z.string().min(1).optional(),
    groupMappings: z.record(z.string()).optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  try {
    await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
    const connection = await upsertSsoConnection(orgId, userHeader, parsed.data);
    return reply.code(parsed.data.id ? 200 : 201).send({ connection });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'sso upsert failed');
    return reply.code(500).send({ error: 'sso_upsert_failed' });
  }
  },
);

app.delete<{ Params: { orgId: string; connectionId: string } }>(
  '/admin/org/:orgId/sso/:connectionId',
  {
    schema: {
      params: {
        type: 'object',
        properties: { orgId: { type: 'string' }, connectionId: { type: 'string' } },
        required: ['orgId', 'connectionId'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
    const { orgId, connectionId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    if (!connectionId || connectionId.trim().length === 0) {
      return reply.code(400).send({ error: 'connectionId is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:manage', orgId, userHeader, request);
      await deleteSsoConnection(orgId, userHeader, connectionId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'sso delete failed');
      return reply.code(500).send({ error: 'sso_delete_failed' });
  }
  },
);

app.get<{ Querystring: { orgId?: string; limit?: string } }>(
  '/metrics/slo',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: { orgId: { type: 'string' }, limit: { type: 'string' } },
        required: ['orgId'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId, limit } = request.query ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:slo', orgId, userHeader, request);
    const query = supabase
      .from('slo_snapshots')
      .select(
        'captured_at, api_uptime_percent, hitl_response_p95_seconds, retrieval_latency_p95_seconds, citation_precision_p95, notes',
      )
      .eq('org_id', orgId)
      .order('captured_at', { ascending: false });

    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined;
    if (parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0) {
      query.limit(parsedLimit);
    }

    const { data, error } = await query;
    if (error) {
      request.log.error({ err: error }, 'slo query failed');
      return reply.code(500).send({ error: 'slo_query_failed' });
    }

    const rows = (data ?? []) as unknown as SloSnapshotRecord[];
    return { summary: summariseSlo(rows), snapshots: rows };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'slo fetch failed');
    return reply.code(500).send({ error: 'slo_query_failed' });
  }
  },
);

app.get<{ Querystring: { orgId?: string; format?: string } }>(
  '/metrics/slo/export',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: { orgId: { type: 'string' }, format: { type: 'string' } },
        required: ['orgId'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId, format } = request.query ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:slo', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('slo_snapshots')
      .select(
        'captured_at, api_uptime_percent, hitl_response_p95_seconds, retrieval_latency_p95_seconds, citation_precision_p95, notes',
      )
      .eq('org_id', orgId)
      .order('captured_at', { ascending: false });

    if (error) {
      request.log.error({ err: error }, 'slo export query failed');
      return reply.code(500).send({ error: 'slo_export_failed' });
    }

    const rows = (data ?? []) as unknown as SloSnapshotRecord[];
    if ((format ?? 'json').toLowerCase() === 'csv') {
      const csvRows = [
        ['captured_at', 'api_uptime_percent', 'hitl_response_p95_seconds', 'retrieval_latency_p95_seconds', 'citation_precision_p95', 'notes'],
        ...rows.map((row) => [
          row.captured_at,
          String(row.api_uptime_percent ?? ''),
          String(row.hitl_response_p95_seconds ?? ''),
          String(row.retrieval_latency_p95_seconds ?? ''),
          row.citation_precision_p95 === null ? '' : String(row.citation_precision_p95),
          (row.notes ?? '').replace(/\n/g, ' '),
        ]),
      ];
      const csv = csvRows
        .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      reply.header('content-type', 'text/csv; charset=utf-8');
      reply.header('content-disposition', `attachment; filename="slo-${orgId}.csv"`);
      return csv;
    }

    return { summary: summariseSlo(rows), snapshots: rows };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'slo export failed');
    return reply.code(500).send({ error: 'slo_export_failed' });
  }
  },
);

app.post<{ Body: { orgId?: string; apiUptimePercent?: number; hitlResponseP95Seconds?: number; retrievalLatencyP95Seconds?: number; citationPrecisionP95?: number | null; notes?: string | null } }>(
  '/metrics/slo',
  async (request, reply) => {
    const bodySchema = z.object({
      orgId: z.string().uuid(),
      apiUptimePercent: z.number().min(0).max(100),
      hitlResponseP95Seconds: z.number().min(0),
      retrievalLatencyP95Seconds: z.number().min(0),
      citationPrecisionP95: z.number().min(0).max(100).nullable().optional(),
      notes: z.string().max(2000).nullable().optional(),
    });
    const parsed = bodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
    }
    const { orgId, apiUptimePercent, hitlResponseP95Seconds, retrievalLatencyP95Seconds, citationPrecisionP95, notes } =
      parsed.data;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }

    try {
      await authorizeRequestWithGuards('metrics:baseline', orgId, userHeader, request);
      const { data, error } = await supabase
        .from('slo_snapshots')
        .insert({
          org_id: orgId,
          api_uptime_percent: apiUptimePercent,
          hitl_response_p95_seconds: hitlResponseP95Seconds,
          retrieval_latency_p95_seconds: retrievalLatencyP95Seconds,
          citation_precision_p95: citationPrecisionP95 ?? null,
          notes: notes ?? null,
          created_by: userHeader,
        })
        .select()
        .single();

      if (error) {
        request.log.error({ err: error }, 'slo insert failed');
        return reply.code(500).send({ error: 'slo_insert_failed' });
      }

      return data;
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'slo insert exception');
      return reply.code(500).send({ error: 'slo_insert_failed' });
    }
  },
);

app.get<{ Querystring: { orgId?: string; kind?: string; limit?: string } }>(
  '/reports/learning',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: { orgId: { type: 'string' }, kind: { type: 'string' }, limit: { type: 'string' } },
        required: ['orgId'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId, kind, limit } = request.query ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let parsedLimit = Number.parseInt(typeof limit === 'string' ? limit : '', 10);
  if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
    parsedLimit = 20;
  }
  parsedLimit = Math.min(Math.max(parsedLimit, 1), 200);

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'learning reports authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  let query = supabase
    .from('agent_learning_reports')
    .select('kind, report_date, payload, created_at')
    .eq('org_id', orgId)
    .order('report_date', { ascending: false })
    .limit(parsedLimit);

  if (kind) {
    query = query.eq('kind', kind);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'learning reports query failed');
    return reply.code(500).send({ error: 'learning_reports_failed' });
  }

  return { reports: mapLearningReports((data ?? []) as LearningReportRow[]) };
  },
);

app.get<{ Querystring: { orgId?: string; periodStart?: string; periodEnd?: string } }>('/reports/dispatches', async (request, reply) => {
  const { orgId, periodStart, periodEnd } = request.query ?? {};
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let range: { start: string; end: string } | undefined;
  if (periodStart || periodEnd) {
    try {
      range = resolveDateRange(periodStart, periodEnd);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : 'invalid_date_range' });
    }
  }

  try {
    await authorizeRequestWithGuards('governance:dispatch', orgId, userHeader, request);
    const query = supabase
      .from('regulator_dispatches')
      .select('id, report_type, period_start, period_end, status, payload_url, metadata, created_at, dispatched_at')
      .eq('org_id', orgId)
      .order('period_start', { ascending: false });

    if (range) {
      query.gte('period_start', range.start).lte('period_end', range.end);
    }

    const { data, error } = await query;
    if (error) {
      request.log.error({ err: error }, 'dispatch query failed');
      return reply.code(500).send({ error: 'dispatch_query_failed' });
    }

    return { dispatches: data ?? [] };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'dispatch fetch failed');
    return reply.code(500).send({ error: 'dispatch_query_failed' });
  }
});

app.get<{ Params: { orgId: string } }>(
  '/admin/org/:orgId/operations/overview',
  {
    schema: {
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('metrics:view', orgId, userHeader, request);

    const [sloResult, incidentResult, changeResult, evidenceResult, regulatorPublication] = await Promise.all([
      supabase
        .from('slo_snapshots')
        .select(
          'captured_at, api_uptime_percent, hitl_response_p95_seconds, retrieval_latency_p95_seconds, citation_precision_p95, notes',
        )
        .eq('org_id', orgId)
        .order('captured_at', { ascending: false })
        .limit(12),
      supabase
        .from('incident_reports')
        .select(
          'id, occurred_at, detected_at, resolved_at, severity, status, title, summary, impact, resolution, follow_up, evidence_url, recorded_at',
        )
        .eq('org_id', orgId)
        .order('occurred_at', { ascending: false })
        .limit(10),
      supabase
        .from('change_log_entries')
        .select('id, entry_date, title, category, summary, release_tag, links, recorded_at')
        .eq('org_id', orgId)
        .order('entry_date', { ascending: false })
        .limit(10),
      supabase
        .from('go_no_go_evidence')
        .select('id, section, criterion, status, evidence_url, notes')
        .eq('org_id', orgId)
        .eq('section', 'H'),
      supabase
        .from('governance_publications')
        .select('slug, status')
        .eq('slug', 'regulator-outreach-plan')
        .maybeSingle(),
    ]);

    const sloError = sloResult.error;
    const incidentError = incidentResult.error;
    const changeError = changeResult.error;
    const evidenceError = evidenceResult.error;
    const regulatorError = regulatorPublication.error;

    if (sloError || incidentError || changeError || evidenceError || regulatorError) {
      request.log.error(
        { sloError, incidentError, changeError, evidenceError, regulatorError },
        'operations overview query failed',
      );
      return reply.code(500).send({ error: 'operations_overview_failed' });
    }

    const sloRows = (sloResult.data ?? []) as SloSnapshotRecord[];
    const sloSummary = summariseSlo(sloRows);
    const sloSnapshots = sloRows.slice(0, 5);

    const incidentRows = (incidentResult.data ?? []) as IncidentRow[];
    const incidents = incidentRows.map((row) => ({
      id: row.id,
      occurredAt: row.occurred_at,
      detectedAt: row.detected_at ?? null,
      resolvedAt: row.resolved_at ?? null,
      severity: row.severity ?? null,
      status: row.status ?? null,
      title: row.title ?? '',
      summary: row.summary ?? '',
      impact: row.impact ?? '',
      resolution: row.resolution ?? '',
      followUp: row.follow_up ?? '',
      evidenceUrl: row.evidence_url ?? null,
      recordedAt: row.recorded_at,
    }));

    const changeRows = (changeResult.data ?? []) as ChangeLogRow[];
    const changeLog = changeRows.map((row) => ({
      id: row.id,
      entryDate: row.entry_date,
      title: row.title ?? '',
      category: row.category ?? '',
      summary: row.summary ?? '',
      releaseTag: row.release_tag ?? null,
      links: row.links ?? null,
      recordedAt: row.recorded_at,
    }));

    const evidenceRows = (evidenceResult.data ?? []) as Array<{
      criterion: string;
      status: string;
      evidence_url: string | null;
      notes?: Record<string, unknown> | null;
    }>;
    const evidenceMap = new Map(evidenceRows.map((row) => [row.criterion, row]));

    const openIncidents = incidents.filter((incident) => incident.status !== 'closed');
    const closedIncidents = incidents.filter((incident) => incident.status === 'closed');
    const regulatorPlanPublished = (regulatorPublication.data?.status ?? null) === 'published';

    const goNoGoCriteria = [
      {
        criterion: 'SLO snapshots capturés',
        autoSatisfied: sloRows.length > 0,
        recommendedEvidenceUrl: 'https://app.avocat-ai.example/governance/slo_and_support.md',
      },
      {
        criterion: 'Incident response & rollback documentés',
        autoSatisfied: closedIncidents.length > 0,
        recommendedEvidenceUrl: 'https://app.avocat-ai.example/governance/incident_response_plan.md',
      },
      {
        criterion: 'Change log opérationnel publié',
        autoSatisfied: changeLog.length > 0,
        recommendedEvidenceUrl: 'https://app.avocat-ai.example/governance/change_management_playbook.md',
      },
      {
        criterion: 'Plan de communication régulateurs partagé',
        autoSatisfied: regulatorPlanPublished,
        recommendedEvidenceUrl: 'https://app.avocat-ai.example/governance/regulator_outreach_plan.md',
      },
    ].map((item) => {
      const recorded = evidenceMap.get(item.criterion);
      return {
        ...item,
        recordedStatus: recorded?.status ?? 'pending',
        recordedEvidenceUrl: recorded?.evidence_url ?? null,
        recordedNotes: recorded?.notes ?? null,
      };
    });

    return {
      slo: {
        summary: sloSummary,
        snapshots: sloSnapshots,
      },
      incidents: {
        total: incidents.length,
        open: openIncidents.length,
        closed: closedIncidents.length,
        latest: incidents[0] ?? null,
        entries: incidents,
      },
      changeLog: {
        total: changeLog.length,
        latest: changeLog[0] ?? null,
        entries: changeLog,
      },
      goNoGo: {
        section: 'H',
        criteria: goNoGoCriteria,
      },
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error, orgId }, 'operations overview failed');
    return reply.code(500).send({ error: 'operations_overview_failed' });
  }
  },
);

app.post<{
  Body: {
    orgId?: string;
    reportType?: string;
    periodStart?: string;
    periodEnd?: string;
    payloadUrl?: string | null;
    status?: string;
    metadata?: Record<string, unknown> | null;
    dispatchedAt?: string | null;
  };
}>('/reports/dispatches', async (request, reply) => {
  const bodySchema = z.object({
    orgId: z.string().uuid(),
    reportType: z.string().min(1),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    payloadUrl: z.string().url().nullable().optional(),
    status: z.string().min(1).optional(),
    metadata: z.record(z.any()).nullable().optional(),
    dispatchedAt: z.string().datetime().nullable().optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { orgId, reportType, periodStart, periodEnd, payloadUrl, status, metadata, dispatchedAt } = parsed.data;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let dispatchedTimestamp: string | null = null;
  if (dispatchedAt) {
    const parsed = new Date(dispatchedAt);
    if (Number.isNaN(parsed.getTime())) {
      return reply.code(400).send({ error: 'invalid_dispatched_at' });
    }
    dispatchedTimestamp = parsed.toISOString();
  }

  try {
    await authorizeRequestWithGuards('governance:dispatch', orgId, userHeader, request);
    const { data, error } = await supabase
      .from('regulator_dispatches')
      .insert({
        org_id: orgId,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        payload_url: payloadUrl ?? null,
        status: status ?? 'draft',
        metadata: metadata ?? null,
        created_by: userHeader,
        dispatched_at: dispatchedTimestamp,
      })
      .select()
      .single();

    if (error) {
      request.log.error({ err: error }, 'dispatch insert failed');
      return reply.code(500).send({ error: 'dispatch_insert_failed' });
    }

    return data;
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'dispatch insert exception');
    return reply.code(500).send({ error: 'dispatch_insert_failed' });
  }
});

app.get<{ Params: { orgId: string } }>(
  '/admin/org/:orgId/scim-tokens',
  {
    schema: {
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    const tokens = await listScimTokens(orgId);
    return { tokens };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'scim token list failed');
    return reply.code(500).send({ error: 'scim_list_failed' });
  }
  },
);

app.post<{
  Params: { orgId: string };
  Body: { name: string; expiresAt?: string | null };
}>('/admin/org/:orgId/scim-tokens',
  {
    schema: {
      params: { type: 'object', properties: { orgId: { type: 'string' } }, required: ['orgId'] },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
      body: {
        type: 'object',
        properties: { label: { type: 'string' } },
        required: ['label'],
        additionalProperties: true,
      },
    },
  },
  async (request, reply) => {
  const { orgId } = request.params;
  const bodySchema = z.object({ name: z.string().min(1), expiresAt: z.string().datetime().nullable().optional() });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { name, expiresAt } = parsed.data;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    const token = await createScimToken(orgId, userHeader, name, expiresAt ?? null);
    return reply.code(201).send(token);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'scim token create failed');
    return reply.code(500).send({ error: 'scim_create_failed' });
  }
  },
);

app.delete<{ Params: { orgId: string; tokenId: string } }>(
  '/admin/org/:orgId/scim-tokens/:tokenId',
  {
    schema: {
      params: {
        type: 'object',
        properties: { orgId: { type: 'string' }, tokenId: { type: 'string' } },
        required: ['orgId', 'tokenId'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
    const { orgId, tokenId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
      await deleteScimToken(orgId, userHeader, tokenId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'scim token delete failed');
      return reply.code(500).send({ error: 'scim_delete_failed' });
    }
  },
);

app.get<{
  Params: { orgId: string };
  Querystring: { limit?: string; object?: string; runId?: string };
}>(
  '/admin/org/:orgId/audit-events',
  async (request, reply) => {
    const { orgId } = request.params;
    const limitParam = request.query.limit ? Number.parseInt(request.query.limit, 10) : 50;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50;
    const objectFilter = request.query.object ? String(request.query.object) : null;
    const runIdFilter = request.query.runId ? String(request.query.runId) : null;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:audit', orgId, userHeader, request);
      let query = supabase
        .from('audit_events')
        .select('id, kind, object, metadata, created_at, actor_user_id')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (objectFilter) {
        query = query.eq('object', objectFilter);
      }
      if (runIdFilter) {
        query = query.eq('metadata->>run_id', runIdFilter);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }
      return { events: data ?? [] };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'audit events fetch failed');
      return reply.code(500).send({ error: 'audit_list_failed' });
    }
  },
);

app.get<{ Params: { orgId: string } }>('/admin/org/:orgId/ip-allowlist', async (request, reply) => {
  const { orgId } = request.params;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    const entries = await listIpAllowlist(orgId);
    return { entries };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'ip allowlist list failed');
    return reply.code(500).send({ error: 'ip_allowlist_list_failed' });
  }
});

app.post<{
  Params: { orgId: string };
  Body: { cidr: string; description?: string | null };
}>('/admin/org/:orgId/ip-allowlist', async (request, reply) => {
  const { orgId } = request.params;
  const bodySchema = z.object({ cidr: z.string().min(1), description: z.string().max(200).nullable().optional() });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { cidr, description } = parsed.data;
  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }
  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    const entry = await upsertIpAllowlist(orgId, userHeader, { cidr, description: description ?? null });
    return reply.code(201).send({ entry });
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'ip allowlist create failed');
    return reply.code(500).send({ error: 'ip_allowlist_create_failed' });
  }
});

app.patch<{
  Params: { orgId: string; entryId: string };
  Body: { cidr: string; description?: string | null };
}>(
  '/admin/org/:orgId/ip-allowlist/:entryId',
  async (request, reply) => {
    const { orgId, entryId } = request.params;
    const bodySchema = z.object({ cidr: z.string().min(1), description: z.string().max(200).nullable().optional() });
    const parsed = bodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
    }
    const { cidr, description } = parsed.data;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
      const entry = await upsertIpAllowlist(orgId, userHeader, { id: entryId, cidr, description: description ?? null });
      return { entry };
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'ip allowlist update failed');
      return reply.code(500).send({ error: 'ip_allowlist_update_failed' });
    }
  },
);

app.delete<{ Params: { orgId: string; entryId: string } }>(
  '/admin/org/:orgId/ip-allowlist/:entryId',
  async (request, reply) => {
    const { orgId, entryId } = request.params;
    const userHeader = request.headers['x-user-id'];
    if (!userHeader || typeof userHeader !== 'string') {
      return reply.code(400).send({ error: 'x-user-id header is required' });
    }
    try {
      await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
      await deleteIpAllowlist(orgId, userHeader, entryId);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'ip allowlist delete failed');
      return reply.code(500).send({ error: 'ip_allowlist_delete_failed' });
    }
  },
);

function scimError(reply: FastifyReply, status: number, detail: string) {
  return reply
    .code(status)
    .header('Content-Type', 'application/scim+json')
    .send({ schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'], detail });
}

app.get('/scim/v2/Users', async (request, reply) => {
  try {
    const result = await listScimUsers(request.headers.authorization ?? '');
    return reply.header('Content-Type', 'application/scim+json').send(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('scim_auth')) {
        return scimError(reply, 401, 'Invalid SCIM token');
      }
      request.log.error({ err: error }, 'scim list failed');
    }
    return scimError(reply, 500, 'Unable to list SCIM users');
  }
});

app.post(
  '/scim/v2/Users',
  {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
      },
      headers: {
        type: 'object',
        properties: {
          authorization: { type: 'string' },
        },
        required: ['authorization'],
      },
      response: {
        201: { type: 'object', additionalProperties: true },
      },
    },
  },
  async (request, reply) => {
    try {
    const result = await createScimUser(
      request.headers.authorization ?? '',
      (request.body as unknown) as ScimUserPayload,
    );
      return reply.code(201).header('Content-Type', 'application/scim+json').send(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('scim_auth')) {
          return scimError(reply, 401, 'Invalid SCIM token');
        }
        request.log.error({ err: error }, 'scim create failed');
      }
      return scimError(reply, 500, 'Unable to create SCIM user');
    }
  },
);

app.patch<{ Params: { id: string } }>(
  '/scim/v2/Users/:id',
  {
    schema: {
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: { type: 'object', additionalProperties: true },
      headers: {
        type: 'object',
        properties: { authorization: { type: 'string' } },
        required: ['authorization'],
      },
      response: {
        200: { type: 'object', additionalProperties: true },
      },
    },
  },
  async (request, reply) => {
    try {
    const result = await patchScimUser(
      request.headers.authorization ?? '',
      request.params.id,
      (request.body as unknown) as ScimPatchRequest,
    );
      return reply.header('Content-Type', 'application/scim+json').send(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith('scim_auth')) {
          return scimError(reply, 401, 'Invalid SCIM token');
        }
        if (error.message === 'scim_user_not_found') {
          return scimError(reply, 404, 'User not found');
        }
        request.log.error({ err: error }, 'scim patch failed');
      }
      return scimError(reply, 500, 'Unable to update SCIM user');
    }
  },
);

app.delete<{ Params: { id: string } }>('/scim/v2/Users/:id', async (request, reply) => {
  try {
    await deleteScimUser(request.headers.authorization ?? '', request.params.id);
    return reply.code(204).send();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('scim_auth')) {
        return scimError(reply, 401, 'Invalid SCIM token');
      }
      request.log.error({ err: error }, 'scim delete failed');
    }
    return scimError(reply, 500, 'Unable to delete SCIM user');
  }
});

app.post<{
  Body: { orgId?: string; userId?: string; eventName?: string; payload?: unknown };
}>(
  '/telemetry',
  {
    schema: {
      body: {
        type: 'object',
        properties: {
          orgId: { type: 'string' },
          userId: { type: 'string' },
          eventName: { type: 'string' },
          payload: { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] },
        },
        required: ['orgId', 'userId', 'eventName'],
        additionalProperties: true,
      },
    },
  },
  async (request, reply) => {
    const ipHeader = (request.headers['x-forwarded-for'] ?? request.ip ?? '').toString();
    const ip = ipHeader.split(',')[0].trim() || 'unknown';
    if (await telemetryRateLimitGuard(request, reply, ['ip', ip])) {
      return;
    }
    const { orgId, userId, eventName, payload } = request.body ?? {};

  if (!orgId || !userId || !eventName) {
    return reply.code(400).send({ error: 'orgId, userId, and eventName are required' });
  }

  try {
    await authorizeRequestWithGuards('telemetry:record', orgId, userId, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'telemetry authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { error } = await supabase.from('ui_telemetry_events').insert({
    org_id: orgId,
    user_id: userId,
    event_name: eventName,
    payload: payload ?? null,
  });

  if (error) {
    request.log.error({ err: error }, 'telemetry insert failed');
    return reply.code(500).send({ error: 'telemetry_failed' });
  }

  return reply.code(204).send();
  },
);

app.get<{ Querystring: { orgId?: string } }>('/workspace', async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  if (await workspaceRateLimitGuard(request, reply, ['overview', orgId, userHeader])) {
    return;
  }

  try {
    await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);
    const [jurisdictionsResult, mattersResult, complianceResult, hitlResult] = await Promise.all([
      supabase.from('jurisdictions').select('code, name, eu, ohada').order('name', { ascending: true }),
      supabase
        .from('agent_runs')
        .select('id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json')
        .eq('org_id', orgId)
        .order('started_at', { ascending: false })
        .limit(8),
      supabase
        .from('sources')
        .select('id, title, publisher, source_url, jurisdiction_code, consolidated, effective_date, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(8),
      supabase
        .from('hitl_queue')
        .select('id, run_id, reason, status, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(8),
    ]);

    const jurisdictionRows = jurisdictionsResult.data ?? [];
    const matterRows = mattersResult.data ?? [];
    const complianceRows = complianceResult.data ?? [];
    const hitlRows = hitlResult.data ?? [];

    if (jurisdictionsResult.error) {
      request.log.error({ err: jurisdictionsResult.error }, 'workspace jurisdictions query failed');
    }
    if (mattersResult.error) {
      request.log.error({ err: mattersResult.error }, 'workspace matters query failed');
    }
    if (complianceResult.error) {
      request.log.error({ err: complianceResult.error }, 'workspace compliance query failed');
    }
    if (hitlResult.error) {
      request.log.error({ err: hitlResult.error }, 'workspace hitl query failed');
    }

    const matterCounts = new Map<string, number>();
    for (const row of matterRows) {
      const jurisdiction = extractCountry(row.jurisdiction_json);
      const key = jurisdiction ?? 'UNK';
      matterCounts.set(key, (matterCounts.get(key) ?? 0) + 1);
    }

    const jurisdictions = jurisdictionRows.map((row) => ({
      code: row.code,
      name: row.name,
      eu: row.eu,
      ohada: row.ohada,
      matterCount: matterCounts.get(row.code) ?? 0,
    }));

    const matters = matterRows.map((row) => ({
      id: row.id,
      question: row.question,
      status: row.status,
      riskLevel: row.risk_level,
      hitlRequired: row.hitl_required,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      jurisdiction: extractCountry(row.jurisdiction_json),
    }));

    const complianceWatch = complianceRows.map((row) => ({
      id: row.id,
      title: row.title,
      publisher: row.publisher,
      url: row.source_url,
      jurisdiction: row.jurisdiction_code,
      consolidated: row.consolidated,
      effectiveDate: row.effective_date,
      createdAt: row.created_at,
    }));

    const hitlInbox = hitlRows.map((row) => ({
      id: row.id,
      runId: row.run_id,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
    }));

    const pendingCount = hitlInbox.filter((item) => item.status === 'pending').length;

    return {
      jurisdictions,
      matters,
      complianceWatch,
      hitlInbox: {
        items: hitlInbox,
        pendingCount,
      },
      desk: buildPhaseCWorkspaceDesk(),
      navigator: buildPhaseCProcessNavigator(),
    };
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'workspace overview failed');
    return reply.code(500).send({ error: 'workspace_failed' });
  }
});

app.get<{ Querystring: { orgId?: string } }>('/citations', async (request, reply) => {
  const { orgId } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('citations:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'citations authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('sources')
    .select(
      'id, title, source_type, jurisdiction_code, source_url, publisher, binding_lang, consolidated, language_note, effective_date, created_at, capture_sha256',
    )
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    request.log.error({ err: error }, 'citations query failed');
    return reply.code(500).send({ error: 'citations_failed' });
  }

  return {
    entries: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      sourceType: row.source_type,
      jurisdiction: row.jurisdiction_code,
      url: row.source_url,
      publisher: row.publisher,
      bindingLanguage: row.binding_lang,
      consolidated: row.consolidated,
      languageNote: row.language_note,
      effectiveDate: row.effective_date,
      capturedAt: row.created_at,
      checksum: row.capture_sha256,
    })),
  };
});

app.get<{ Querystring: { orgId?: string; sourceId?: string } }>('/case-scores', async (request, reply) => {
  const { orgId, sourceId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'case_scores authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const query = supabase
    .from('case_scores')
    .select('id, source_id, juris_code, score_overall, axes, hard_block, version, model_ref, notes, computed_at, sources(title, source_url, trust_tier, court_rank)')
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false })
    .limit(50);

  if (sourceId) {
    query.eq('source_id', sourceId);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'case_scores query failed');
    return reply.code(500).send({ error: 'case_scores_failed' });
  }

  return {
    scores: (data ?? []).map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      jurisdiction: row.juris_code,
      score: row.score_overall,
      axes: row.axes,
      hardBlock: row.hard_block,
      version: row.version,
      modelRef: row.model_ref,
      notes: row.notes,
      computedAt: row.computed_at,
      source: (row as any).sources
        ? {
            title: (row as any).sources.title,
            url: (row as any).sources.source_url,
            trustTier: (row as any).sources.trust_tier,
            courtRank: (row as any).sources.court_rank,
          }
        : null,
    })),
  };
});

app.get<{ Querystring: { orgId?: string; sourceId?: string } }>('/case-treatments', async (request, reply) => {
  const { orgId, sourceId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'case_treatments authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const query = supabase
    .from('case_treatments')
    .select('id, source_id, citing_source_id, treatment, court_rank, weight, decided_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (sourceId) {
    query.eq('source_id', sourceId);
  }

  const { data, error } = await query;
  if (error) {
    request.log.error({ err: error }, 'case_treatments query failed');
    return reply.code(500).send({ error: 'case_treatments_failed' });
  }

  return { treatments: data ?? [] };
});

app.get<{ Querystring: { orgId?: string; sourceId?: string } }>('/case-statute-links', async (request, reply) => {
  const { orgId, sourceId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  if (!sourceId) {
    return reply.code(400).send({ error: 'sourceId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'case_statute_links authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('case_statute_links')
    .select('id, statute_url, article, alignment_score, rationale_json, created_at')
    .eq('org_id', orgId)
    .eq('case_source_id', sourceId)
    .order('created_at', { ascending: false });

  if (error) {
    request.log.error({ err: error }, 'case_statute_links query failed');
    return reply.code(500).send({ error: 'case_statute_links_failed' });
  }

  return { links: data ?? [] };
});

app.get<{
  Querystring: { orgId?: string; jurisdiction?: string; matterType?: string };
}>('/drafting/templates', async (request, reply) => {
  const { orgId, jurisdiction, matterType } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('templates:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'templates authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  let query = supabase
    .from('pleading_templates')
    .select('id, org_id, jurisdiction_code, matter_type, title, summary, sections, fill_ins, locale, created_at')
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('jurisdiction_code', { ascending: true })
    .order('created_at', { ascending: false });

  if (jurisdiction) {
    query = query.in('jurisdiction_code', [jurisdiction, 'FR', 'OHADA']);
  }

  if (matterType) {
    query = query.eq('matter_type', matterType);
  }

  const { data, error } = await query;

  if (error) {
    request.log.error({ err: error }, 'templates query failed');
    return reply.code(500).send({ error: 'templates_unavailable' });
  }

  return {
    templates: (data ?? []).map((row) => ({
      id: row.id,
      jurisdiction: row.jurisdiction_code,
      matterType: row.matter_type,
      title: row.title,
      summary: row.summary,
      sections: row.sections,
      fillIns: row.fill_ins,
      locale: row.locale,
      scope: row.org_id ? 'org' : 'global',
    })),
  };
});

app.get<{ Querystring: { orgId?: string } }>('/hitl/metrics', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('hitl:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'hitl metrics authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('agent_learning_reports')
    .select('kind, report_date, payload')
    .eq('org_id', orgId)
    .in('kind', ['queue', 'drift', 'fairness'])
    .order('report_date', { ascending: false })
    .limit(90);

  if (error) {
    request.log.error({ err: error }, 'hitl metrics query failed');
    return reply.code(500).send({ error: 'hitl_metrics_failed' });
  }

  const latest = new Map<
    string,
    { reportDate: string | null; payload: Record<string, unknown> | null }
  >();

  const fairnessReports: Array<{
    reportDate: string | null;
    capturedAt: string | null;
    windowStart: string | null;
    windowEnd: string | null;
    overall: Record<string, unknown> | null;
    jurisdictions: Array<Record<string, unknown>>;
    benchmarks: Array<Record<string, unknown>>;
    flagged: { jurisdictions: string[]; benchmarks: string[] };
  }> = [];

  for (const row of data ?? []) {
    const kind = typeof row.kind === 'string' ? row.kind : null;
    if (!kind) {
      continue;
    }

    const payload = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : null;
    const reportDate = typeof row.report_date === 'string' ? row.report_date : null;

    if (!latest.has(kind)) {
      latest.set(kind, { reportDate, payload });
    }

    if (kind === 'fairness' && payload) {
      const windowStart = typeof payload.windowStart === 'string' ? payload.windowStart : null;
      const windowEnd = typeof payload.windowEnd === 'string' ? payload.windowEnd : null;
      const capturedAt =
        typeof payload.capturedAt === 'string'
          ? payload.capturedAt
          : typeof payload.windowEnd === 'string'
          ? payload.windowEnd
          : reportDate;

      const jurisdictions = Array.isArray(payload.jurisdictions)
        ? payload.jurisdictions
            .map((entry) => normaliseFairnessJurisdiction(entry))
            .filter((entry): entry is Record<string, unknown> => entry !== null)
        : [];

      const benchmarks = Array.isArray(payload.benchmarks)
        ? payload.benchmarks
            .map((entry) => normaliseFairnessBenchmark(entry))
            .filter((entry): entry is Record<string, unknown> => entry !== null)
        : [];

      const flagged =
        payload.flagged && typeof payload.flagged === 'object'
          ? {
              jurisdictions: Array.isArray((payload.flagged as Record<string, unknown>).jurisdictions)
                ? ((payload.flagged as Record<string, unknown>).jurisdictions as unknown[])
                    .filter((code): code is string => typeof code === 'string')
                : [],
              benchmarks: Array.isArray((payload.flagged as Record<string, unknown>).benchmarks)
                ? ((payload.flagged as Record<string, unknown>).benchmarks as unknown[])
                    .filter((name): name is string => typeof name === 'string')
                : [],
            }
          : { jurisdictions: [], benchmarks: [] };

      fairnessReports.push({
        reportDate,
        capturedAt,
        windowStart,
        windowEnd,
        overall:
          payload.overall && typeof payload.overall === 'object'
            ? normaliseFairnessOverall(payload.overall as Record<string, unknown>)
            : null,
        jurisdictions,
        benchmarks,
        flagged,
      });
    }
  }

  const queueRow = latest.get('queue');
  const queuePayload = queueRow?.payload ?? null;
  const queue = queuePayload
    ? {
        reportDate: queueRow?.reportDate ?? null,
        pending: toNumber(queuePayload.pending) ?? 0,
        byType: toNumberRecord(queuePayload.byType),
        oldestCreatedAt:
          typeof queuePayload.oldestCreatedAt === 'string' ? queuePayload.oldestCreatedAt : null,
        capturedAt:
          typeof queuePayload.capturedAt === 'string'
            ? queuePayload.capturedAt
            : queueRow?.reportDate ?? null,
      }
    : null;

  const driftRow = latest.get('drift');
  const driftPayload = driftRow?.payload ?? null;
  const drift = driftPayload
    ? {
        reportDate: driftRow?.reportDate ?? null,
        totalRuns: toNumber(driftPayload.totalRuns) ?? 0,
        highRiskRuns: toNumber(driftPayload.highRiskRuns) ?? 0,
        hitlEscalations: toNumber(driftPayload.hitlEscalations) ?? 0,
        allowlistedRatio: toNumber(driftPayload.allowlistedRatio),
      }
    : null;

  const fairnessRow = latest.get('fairness');
  const fairnessPayload = fairnessRow?.payload ?? null;
  const fairness = fairnessPayload
    ? {
        reportDate: fairnessRow?.reportDate ?? null,
        overall:
          fairnessPayload.overall && typeof fairnessPayload.overall === 'object'
            ? normaliseFairnessOverall(fairnessPayload.overall as Record<string, unknown>)
            : null,
        capturedAt:
          typeof fairnessPayload.capturedAt === 'string'
            ? fairnessPayload.capturedAt
            : fairnessRow?.reportDate ?? null,
        jurisdictions: Array.isArray(fairnessPayload.jurisdictions)
          ? fairnessPayload.jurisdictions
              .map((entry) => normaliseFairnessJurisdiction(entry))
              .filter((entry): entry is Record<string, unknown> => entry !== null)
          : [],
        benchmarks: Array.isArray(fairnessPayload.benchmarks)
          ? fairnessPayload.benchmarks
              .map((entry) => normaliseFairnessBenchmark(entry))
              .filter((entry): entry is Record<string, unknown> => entry !== null)
          : [],
        flagged:
          fairnessPayload.flagged && typeof fairnessPayload.flagged === 'object'
            ? {
                jurisdictions: Array.isArray((fairnessPayload.flagged as Record<string, unknown>).jurisdictions)
                  ? ((fairnessPayload.flagged as Record<string, unknown>).jurisdictions as unknown[])
                      .filter((code): code is string => typeof code === 'string')
                  : [],
                benchmarks: Array.isArray((fairnessPayload.flagged as Record<string, unknown>).benchmarks)
                  ? ((fairnessPayload.flagged as Record<string, unknown>).benchmarks as unknown[])
                      .filter((name): name is string => typeof name === 'string')
                  : [],
              }
            : { jurisdictions: [], benchmarks: [] },
        trend: fairnessReports
          .slice(0, 12)
          .map((entry) => ({
            reportDate: entry.reportDate,
            capturedAt: entry.capturedAt,
            windowStart: entry.windowStart,
            windowEnd: entry.windowEnd,
            overall: entry.overall,
            jurisdictions: entry.jurisdictions,
            benchmarks: entry.benchmarks,
            flagged: entry.flagged,
          })),
      }
    : null;

  return {
    orgId,
    metrics: {
      queue,
      drift,
      fairness,
    },
  };
});

app.get<{ Querystring: { orgId?: string } }>('/hitl', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('hitl:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'hitl view authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('hitl_queue')
    .select('id, run_id, reason, status, created_at, updated_at, resolution_minutes, resolution_bucket, reviewer_comment')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) {
    request.log.error({ err: error }, 'hitl query failed');
    return reply.code(500).send({ error: 'hitl_failed' });
  }

  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      runId: row.run_id,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      resolutionMinutes: row.resolution_minutes,
      resolutionBucket: row.resolution_bucket,
      reviewerComment: row.reviewer_comment,
    })),
  };
});

app.get<{ Params: { id: string }; Querystring: { orgId?: string } }>('/hitl/:id', async (request, reply) => {
  const { id } = request.params;
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('hitl:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'hitl detail authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const hitlRecord = await supabase
    .from('hitl_queue')
    .select('id, run_id, reason, status, created_at, updated_at, resolution_minutes, resolution_bucket, reviewer_comment')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (hitlRecord.error) {
    request.log.error({ err: hitlRecord.error }, 'hitl detail query failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }
  if (!hitlRecord.data) {
    return reply.code(404).send({ error: 'hitl_not_found' });
  }

  const runId = hitlRecord.data.run_id as string | null;
  const [run, citations, retrieval, edits] = await Promise.all([
    runId
      ? supabase
          .from('agent_runs')
          .select('id, org_id, question, jurisdiction_json, irac, risk_level, status, started_at, finished_at, hitl_required')
          .eq('id', runId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    runId
      ? supabase
          .from('run_citations')
          .select('title, publisher, url, domain_ok, note')
          .eq('run_id', runId)
      : Promise.resolve({ data: [], error: null }),
    runId
      ? supabase
          .from('run_retrieval_sets')
          .select('id, origin, snippet, similarity, weight, metadata')
          .eq('run_id', runId)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from('hitl_reviewer_edits')
      .select('id, action, comment, reviewer_id, created_at, previous_payload, revised_payload')
      .eq('hitl_id', id)
      .order('created_at', { ascending: false }),
  ]);

  if (run && run.error) {
    request.log.error({ err: run.error }, 'hitl detail run fetch failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }
  if (citations.error) {
    request.log.error({ err: citations.error }, 'hitl detail citations failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }
  if (retrieval.error) {
    request.log.error({ err: retrieval.error }, 'hitl detail retrieval failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }
  if (edits.error) {
    request.log.error({ err: edits.error }, 'hitl detail reviewer edits failed');
    return reply.code(500).send({ error: 'hitl_detail_failed' });
  }

  const runData = run?.data ?? null;

  return {
    hitl: {
      id: hitlRecord.data.id,
      reason: hitlRecord.data.reason,
      status: hitlRecord.data.status,
      createdAt: hitlRecord.data.created_at,
      updatedAt: hitlRecord.data.updated_at,
      resolutionMinutes: hitlRecord.data.resolution_minutes,
      resolutionBucket: hitlRecord.data.resolution_bucket,
      reviewerComment: hitlRecord.data.reviewer_comment,
    },
    run: runData
      ? {
          id: runData.id,
          orgId: runData.org_id ?? null,
          question: runData.question,
          jurisdiction: extractCountry(runData.jurisdiction_json),
          irac: runData.irac,
          riskLevel: runData.risk_level,
          status: runData.status,
          hitlRequired: runData.hitl_required,
          startedAt: runData.started_at,
          finishedAt: runData.finished_at,
        }
      : null,
    citations: (citations.data ?? []).map((citation) => ({
      title: citation.title,
      publisher: citation.publisher,
      url: citation.url,
      domainOk: citation.domain_ok,
      note: citation.note ?? null,
    })),
    retrieval: (retrieval.data ?? []).map((entry) => ({
      id: entry.id,
      origin: entry.origin,
      snippet: entry.snippet,
      similarity: entry.similarity === null ? null : Number(entry.similarity),
      weight: entry.weight === null ? null : Number(entry.weight),
      metadata: typeof entry.metadata === 'object' && entry.metadata !== null ? entry.metadata : {},
    })),
    edits:
      edits.data?.map((row) => ({
        id: row.id,
        action: row.action,
        comment: row.comment,
        reviewerId: row.reviewer_id,
        createdAt: row.created_at,
        previousPayload: row.previous_payload ?? null,
        revisedPayload: row.revised_payload ?? null,
      })) ?? [],
  };
});

app.post<{
  Params: { id: string };
  Body: { action?: string; comment?: string; reviewerId?: string; revisedPayload?: IRACPayload | null };
}>(
  '/hitl/:id',
  async (request, reply) => {
    const { id } = request.params;
    const bodySchema = z.object({
      action: z.enum(['approve', 'reject', 'request_changes']),
      comment: z.string().max(2000).optional(),
      reviewerId: z.string().uuid().optional(),
      revisedPayload: z.any().nullable().optional(),
    });
    const parsed = bodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
    }
    const { action, comment, reviewerId, revisedPayload } = parsed.data;

    const userHeader = request.headers['x-user-id'];
    const orgHeader = request.headers['x-org-id'];
    if (!userHeader || typeof userHeader !== 'string' || !orgHeader || typeof orgHeader !== 'string') {
      return reply
        .code(400)
        .send({ error: 'x-user-id and x-org-id headers are required for HITL actions' });
    }

    try {
      await authorizeRequestWithGuards('hitl:act', orgHeader, userHeader, request);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'hitl action authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    const statusMap: Record<string, string> = {
      approve: 'approved',
      request_changes: 'changes_requested',
      reject: 'rejected',
    };
    const newStatus = statusMap[action];
    if (!newStatus) {
      return reply.code(400).send({ error: 'invalid_action' });
    }

    const existingResult = await supabase
      .from('hitl_queue')
      .select('id, run_id, org_id, created_at, status')
      .eq('id', id)
      .maybeSingle();

    if (existingResult.error) {
      request.log.error({ err: existingResult.error }, 'hitl fetch failed before action');
      return reply.code(500).send({ error: 'hitl_fetch_failed' });
    }

    const existing = existingResult.data as
      | { id?: string; run_id?: string; org_id?: string | null; created_at?: string | null; status?: string }
      | null;
    if (!existing) {
      return reply.code(404).send({ error: 'hitl_not_found' });
    }

    const runLookup = existing.run_id
      ? await supabase
          .from('agent_runs')
          .select('id, org_id, irac')
          .eq('id', existing.run_id as string)
          .maybeSingle()
      : { data: null, error: null };

    if (runLookup.error) {
      request.log.warn({ err: runLookup.error }, 'hitl run lookup failed for reviewer edit');
    }

    const previousPayload =
      runLookup.data && typeof runLookup.data === 'object' && 'irac' in runLookup.data
        ? (runLookup.data.irac as IRACPayload | null)
        : null;
    const runOrgIdCandidate =
      (runLookup.data && typeof runLookup.data === 'object' && runLookup.data.org_id
        ? (runLookup.data.org_id as string)
        : null) ?? (typeof existing.org_id === 'string' ? existing.org_id : null);

    const sanitizedRevisedPayload =
      revisedPayload && typeof revisedPayload === 'object' ? revisedPayload : null;

    const now = new Date();
    const nowIso = now.toISOString();
    const rawMinutes = minutesBetween(existing.created_at as string | null, now);
    const minutes = rawMinutes === null ? null : Math.round(rawMinutes * 100) / 100;
    const bucket = bucketResolution(minutes);
    const reviewerReference = reviewerId ?? userHeader;

    const update = await supabase
      .from('hitl_queue')
      .update({
        status: newStatus,
        reviewer_id: reviewerReference ?? null,
        updated_at: nowIso,
        reviewer_comment: comment ?? null,
        resolution_minutes: minutes,
        resolution_bucket: bucket,
      })
      .eq('id', id)
      .select('run_id, org_id')
      .single();

    if (update.error || !update.data) {
      request.log.error({ err: update.error }, 'hitl update failed');
      return reply.code(500).send({ error: 'hitl_update_failed' });
    }

    await supabase
      .from('agent_runs')
      .update({ status: newStatus, hitl_required: newStatus !== 'approved' })
      .eq('id', update.data.run_id);

    const editInsert = await supabase.from('hitl_reviewer_edits').insert({
      hitl_id: id,
      run_id: update.data.run_id,
      org_id:
        runOrgIdCandidate ??
        (typeof update.data.org_id === 'string' ? update.data.org_id : null) ??
        orgHeader,
      reviewer_id: reviewerReference ?? null,
      action: newStatus,
      comment: comment ?? null,
      previous_payload: previousPayload ?? null,
      revised_payload: sanitizedRevisedPayload,
    });

    if (editInsert.error) {
      request.log.warn({ err: editInsert.error }, 'hitl reviewer edit insert failed');
    }

    if (newStatus !== 'approved') {
      const learningInsert = await supabase.from('agent_learning_jobs').insert({
        org_id: update.data.org_id ?? existing.org_id ?? null,
        type: 'review_feedback_ticket',
        payload: {
          runId: update.data.run_id,
          hitlId: id,
          action: newStatus,
          reviewerId: reviewerReference ?? null,
          comment: comment ?? null,
          resolutionMinutes: minutes ?? null,
        },
      });
      if (learningInsert.error) {
        request.log.warn({ err: learningInsert.error }, 'review feedback learning job insert failed');
      }
    }

    try {
      await logAuditEvent({
        orgId: orgHeader,
        actorId: userHeader,
        kind: 'hitl.action',
        object: id,
        metadata: {
          run_id: update.data.run_id,
          status: newStatus,
          comment: comment ?? null,
          resolution_minutes: minutes ?? null,
          resolution_bucket: bucket,
        },
      });
    } catch (error) {
      request.log.warn({ err: error }, 'hitl audit failed');
    }

    return { status: newStatus, resolutionMinutes: minutes ?? null, resolutionBucket: bucket };
  },
);

app.get<{ Querystring: { orgId?: string } }>('/matters', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'matters authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('agent_runs')
    .select('id, question, risk_level, hitl_required, status, started_at, finished_at, jurisdiction_json, irac')
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .limit(50);

  if (error) {
    request.log.error({ err: error }, 'matters query failed');
    return reply.code(500).send({ error: 'matters_failed' });
  }

  const matters = (data ?? []).map((row) => ({
    id: row.id,
    question: row.question,
    riskLevel: row.risk_level,
    status: row.status,
    hitlRequired: row.hitl_required,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    jurisdiction: extractCountry(row.jurisdiction_json),
    conclusion: typeof row.irac === 'object' ? (row.irac as { conclusion?: string }).conclusion ?? null : null,
  }));

  return { matters };
});

app.get<{ Params: { id: string }; Querystring: { orgId?: string } }>('/matters/:id', async (request, reply) => {
  const { orgId } = request.query;
  const { id } = request.params;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('cases:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'matter detail authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const run = await supabase
    .from('agent_runs')
    .select('id, question, jurisdiction_json, irac, risk_level, started_at, finished_at, hitl_required, status')
    .eq('org_id', orgId)
    .eq('id', id)
    .single();

  if (run.error || !run.data) {
    request.log.error({ err: run.error }, 'matter detail failed');
    return reply.code(404).send({ error: 'matter_not_found' });
  }

  const citations = await supabase
    .from('run_citations')
    .select('title, publisher, url, domain_ok, note')
    .eq('run_id', id);
  const tools = await supabase
    .from('tool_invocations')
    .select('name, args, output, created_at')
    .eq('run_id', id)
    .order('created_at', { ascending: true });

  return {
    matter: {
      id: run.data.id,
      question: run.data.question,
      jurisdiction: extractCountry(run.data.jurisdiction_json),
      irac: run.data.irac,
      riskLevel: run.data.risk_level,
      startedAt: run.data.started_at,
      finishedAt: run.data.finished_at,
      status: run.data.status,
      hitlRequired: run.data.hitl_required,
      citations: (citations.data ?? []).map((citation) => ({
        title: citation.title,
        publisher: citation.publisher,
        url: citation.url,
        domainOk: citation.domain_ok,
        note: citation.note ?? null,
      })),
      tools: (tools.data ?? []).map((tool) => ({
        name: tool.name,
        args: typeof tool.args === 'object' && tool.args !== null ? tool.args : {},
        output: typeof tool.output === 'object' && tool.output !== null ? tool.output : tool.output ?? null,
        createdAt: tool.created_at,
      })),
    },
  };
});

app.post<{
  Body: {
    orgId?: string;
    userId?: string;
    name?: string;
    mimeType?: string;
    contentBase64?: string;
    bucket?: 'uploads' | 'authorities';
    residencyZone?: string | null;
    source?: {
      jurisdiction_code?: string;
      source_type?: string;
      title?: string;
      publisher?: string | null;
      source_url?: string | null;
      binding_lang?: string | null;
      consolidated?: boolean;
      effective_date?: string | null;
    } | null;
  };
}>('/upload', async (request, reply) => {
  const body = request.body ?? {};
  const orgId = body.orgId;
  const userId = body.userId ?? (request.headers['x-user-id'] as string | undefined);
  const bucket = body.bucket ?? 'uploads';
  const name = body.name ?? '';
  const mimeType = body.mimeType ?? 'application/octet-stream';
  const contentBase64 = body.contentBase64 ?? '';

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }
  if (!userId) {
    return reply.code(400).send({ error: 'x-user-id header or userId is required' });
  }
  if (!name || !contentBase64) {
    return reply.code(400).send({ error: 'name and contentBase64 are required' });
  }

  let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
  try {
    access = await authorizeRequestWithGuards('corpus:manage', orgId, userId, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'upload authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  let buffer: Buffer;
  try {
    const base64 = contentBase64.includes(',') ? contentBase64.split(',').pop() ?? '' : contentBase64;
    buffer = Buffer.from(base64, 'base64');
  } catch (_err) {
    return reply.code(400).send({ error: 'invalid_base64' });
  }

  let residencyZone: string;
  try {
    residencyZone = await determineResidencyZone(orgId, access, body.residencyZone);
  } catch (error) {
    if (error instanceof ResidencyError) {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'determine_residency_zone_failed');
    return reply.code(500).send({ error: 'residency_validation_failed' });
  }

  const storagePath = makeStoragePath(orgId, residencyZone, name);
  const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
  const upload = await supabase.storage.from(bucket).upload(storagePath, blob, {
    contentType: mimeType,
    upsert: false,
  });
  if (upload.error) {
    request.log.error({ err: upload.error }, 'storage upload failed');
    return reply.code(500).send({ error: 'storage_upload_failed' });
  }

  let sourceId: string | null = null;
  if (
    bucket === 'authorities' &&
    body.source &&
    body.source.title &&
    body.source.jurisdiction_code &&
    body.source.source_type
  ) {
    const sourceInsert = await supabase
      .from('sources')
      .insert({
        org_id: orgId,
        jurisdiction_code: body.source.jurisdiction_code,
        source_type: body.source.source_type,
        title: body.source.title,
        publisher: body.source.publisher ?? null,
        source_url: body.source.source_url ?? `https://storage/${bucket}/${storagePath}`,
        binding_lang: body.source.binding_lang ?? null,
        consolidated: Boolean(body.source.consolidated ?? false),
        effective_date: body.source.effective_date ?? null,
        residency_zone: residencyZone,
      })
      .select('id')
      .single();
    if (!sourceInsert.error) {
      sourceId = sourceInsert.data?.id ?? null;
    } else {
      request.log.warn({ err: sourceInsert.error }, 'source insert failed');
    }
  }

  const documentInsert = await supabase
    .from('documents')
    .insert({
      org_id: orgId,
      source_id: sourceId,
      name,
      storage_path: storagePath,
      bucket_id: bucket,
      mime_type: mimeType,
      bytes: buffer.byteLength,
      vector_store_status: 'pending',
      summary_status: 'pending',
      chunk_count: 0,
      residency_zone: residencyZone,
    })
    .select('id')
    .single();
  if (documentInsert.error || !documentInsert.data) {
    request.log.error({ err: documentInsert.error }, 'document insert failed');
    return reply.code(500).send({ error: 'document_insert_failed' });
  }

  return reply.send({
    documentId: (documentInsert.data as { id: string }).id,
    bucket,
    storagePath,
    residencyZone,
    bytes: buffer.byteLength,
  });
});

app.get<{ Querystring: { orgId?: string } }>('/corpus', async (request, reply) => {
  const { orgId } = request.query;
  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  let access: Awaited<ReturnType<typeof authorizeRequestWithGuards>>;
  try {
    access = await authorizeRequestWithGuards('corpus:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'corpus authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const [domains, snapshots, uploads, ingestions, summaries] = await Promise.all([
    supabase.from('authority_domains').select('jurisdiction_code, host, active, last_ingested_at'),
    supabase
      .from('documents')
      .select(
        'id, name, storage_path, residency_zone, vector_store_status, vector_store_synced_at, created_at, bytes, mime_type, summary_status, summary_generated_at, summary_error, chunk_count, bucket_id, source_id',
      )
      .eq('org_id', orgId)
      .eq('bucket_id', 'authorities')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('documents')
      .select('id, name, storage_path, residency_zone, created_at, bytes, mime_type')
      .eq('org_id', orgId)
      .eq('bucket_id', 'uploads')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('ingestion_runs')
      .select('id, adapter_id, status, inserted_count, skipped_count, failed_count, started_at, finished_at, error_message')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false })
      .limit(25),
    supabase
      .from('document_summaries')
      .select('document_id, summary, outline, created_at')
      .eq('org_id', orgId),
  ]);

  const ingestionRuns = (ingestions.data ?? []).map((run) => ({
    id: run.id,
    adapter: run.adapter_id,
    status: run.status,
    inserted: run.inserted_count,
    skipped: run.skipped_count,
    failed: run.failed_count,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    error: run.error_message,
  }));

  const summaryMap = new Map((summaries.data ?? []).map((row) => [row.document_id, row] as const));
  const allowedResidencyZones = collectAllowedResidencyZones(access);
  const activeResidencyZone =
    access.policies.residencyZone ?? allowedResidencyZones[0] ?? null;

  return {
    allowlist: (domains.data ?? []).map((row) => ({
      jurisdiction: row.jurisdiction_code,
      host: row.host,
      active: row.active ?? true,
      lastIngestedAt: row.last_ingested_at,
    })),
    snapshots: (snapshots.data ?? []).map((doc) => {
      const summaryRow = summaryMap.get(doc.id) ?? null;
      return {
        id: doc.id,
        name: doc.name,
        path: doc.storage_path,
        status: doc.vector_store_status,
        syncedAt: doc.vector_store_synced_at,
        createdAt: doc.created_at,
        bytes: doc.bytes,
        mimeType: doc.mime_type,
        summaryStatus: doc.summary_status,
        summaryGeneratedAt: doc.summary_generated_at,
        summaryError: doc.summary_error,
        chunkCount: doc.chunk_count ?? 0,
        summary: summaryRow?.summary ?? null,
        highlights: Array.isArray(summaryRow?.outline) ? summaryRow?.outline : null,
        residencyZone: typeof doc.residency_zone === 'string' ? doc.residency_zone : extractResidencyFromPath(doc.storage_path),
      };
    }),
    uploads: (uploads.data ?? []).map((doc) => ({
      id: doc.id,
      name: doc.name,
      path: doc.storage_path,
      createdAt: doc.created_at,
      bytes: doc.bytes,
      mimeType: doc.mime_type,
      residencyZone: typeof doc.residency_zone === 'string' ? doc.residency_zone : extractResidencyFromPath(doc.storage_path),
    })),
    ingestionRuns,
    residency: {
      activeZone: activeResidencyZone,
      allowedZones: allowedResidencyZones,
    },
  };
});

app.post<{
  Params: { documentId: string };
  Body: { orgId?: string; summariserModel?: string; embeddingModel?: string; maxSummaryChars?: number };
}>('/corpus/:documentId/resummarize', async (request, reply) => {
  const bodySchema = z.object({
    orgId: z.string().uuid(),
    summariserModel: z.string().min(1).optional(),
    embeddingModel: z.string().min(1).optional(),
    maxSummaryChars: z.coerce.number().int().positive().max(12000).optional(),
  });
  const { documentId } = request.params;
  const parsedBody = bodySchema.safeParse(request.body ?? {});
  if (!parsedBody.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsedBody.error.flatten() });
  }
  const { orgId, summariserModel, embeddingModel, maxSummaryChars } = parsedBody.data;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:manage', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'corpus resummarize authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('id, org_id, bucket_id, storage_path, mime_type, source_id, name')
    .eq('id', documentId)
    .eq('org_id', orgId)
    .maybeSingle();

  if (documentError) {
    request.log.error({ err: documentError }, 'document fetch failed');
    return reply.code(500).send({ error: 'document_unavailable' });
  }

  if (!document) {
    return reply.code(404).send({ error: 'document_not_found' });
  }

  if (document.bucket_id !== 'authorities') {
    return reply.code(400).send({ error: 'resummarize_supported_only_for_authorities' });
  }

  const { data: source } = await supabase
    .from('sources')
    .select(
      'title, publisher, jurisdiction_code, source_url, adopted_date, effective_date, binding_lang, language_note, consolidated, eli, ecli, akoma_ntoso',
    )
    .eq('id', document.source_id ?? '')
    .maybeSingle();

  const metadata = {
    title: source?.title ?? document.name,
    jurisdiction: source?.jurisdiction_code ?? 'FR',
    publisher: source?.publisher ?? null,
  };

  const { data: blob, error: downloadError } = await supabase.storage
    .from(document.bucket_id)
    .download(document.storage_path);

  if (downloadError || !blob) {
    request.log.error({ err: downloadError }, 'document download failed');
    return reply.code(500).send({ error: 'document_download_failed' });
  }

  const buffer = await (blob as Blob).arrayBuffer();
  const payload = new Uint8Array(buffer);

  const result = await summariseDocumentFromPayload({
    payload,
    mimeType: document.mime_type ?? 'text/plain',
    metadata,
    openaiApiKey: env.OPENAI_API_KEY,
    summariserModel,
    embeddingModel,
    maxSummaryChars,
    logger: request.log,
  });

  const nowIso = new Date().toISOString();
  let finalStatus = result.status;
  let summaryError: string | null = result.error ?? null;
  let chunkCount = result.status === 'ready' ? result.chunks.length : 0;

  if (result.status === 'ready' && result.chunks.length !== result.embeddings.length) {
    finalStatus = 'failed';
    summaryError = 'Nombre de chunks et embeddings incohérent';
  }

  if (finalStatus === 'ready') {
    await supabase.from('document_chunks').delete().eq('document_id', document.id);

    const rows = result.chunks.map((chunk, index) => ({
      org_id: orgId,
      document_id: document.id,
      jurisdiction_code: metadata.jurisdiction,
      content: chunk.content,
      embedding: result.embeddings[index],
      seq: chunk.seq,
      article_or_section: chunk.marker,
    }));

    for (let idx = 0; idx < rows.length; idx += 50) {
      const batch = rows.slice(idx, idx + 50);
      const { error } = await supabase.from('document_chunks').insert(batch);
      if (error) {
        request.log.error({ err: error }, 'chunk insert failed');
        finalStatus = 'failed';
        summaryError = error.message;
        chunkCount = 0;
        break;
      }
    }

    if (finalStatus !== 'ready') {
      await supabase.from('document_chunks').delete().eq('document_id', document.id);
    }

    if (finalStatus === 'ready') {
      const { error: summaryErrorUpsert } = await supabase
        .from('document_summaries')
        .upsert(
          {
            org_id: orgId,
            document_id: document.id,
            summary: result.summary ?? null,
            outline: result.highlights && result.highlights.length > 0 ? result.highlights : null,
          },
          { onConflict: 'document_id' },
        );

      if (summaryErrorUpsert) {
        request.log.error({ err: summaryErrorUpsert }, 'summary upsert failed');
        finalStatus = 'failed';
        summaryError = summaryErrorUpsert.message;
        chunkCount = 0;
      }
    }

    if (finalStatus === 'ready') {
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          summary_status: 'ready',
          summary_generated_at: nowIso,
          summary_error: null,
          chunk_count: chunkCount,
        })
        .eq('id', document.id);

      if (updateError) {
        request.log.error({ err: updateError }, 'document summary update failed');
        finalStatus = 'failed';
        summaryError = updateError.message;
      }
    }

    if (finalStatus === 'ready' && document.source_id) {
      const MAX_AKOMA_ARTICLES = 400;
      const articleCandidates = result.chunks.filter(
        (chunk) => typeof chunk.marker === 'string' && chunk.marker.length > 0,
      );
      const articles = articleCandidates.slice(0, MAX_AKOMA_ARTICLES).map((chunk) => ({
          marker: chunk.marker as string,
          seq: chunk.seq,
          excerpt: chunk.content.slice(0, 280).trim(),
        }));

      if (articleCandidates.length > MAX_AKOMA_ARTICLES) {
        request.log.info(
          {
            sourceId: document.source_id ?? null,
            totalArticles: articleCandidates.length,
            maxArticles: MAX_AKOMA_ARTICLES,
          },
          'akoma_ntoso_articles_truncated',
        );
      }

      const existingAkoma =
        source && typeof source.akoma_ntoso === 'object' && source.akoma_ntoso
          ? (source.akoma_ntoso as {
              meta?: { publication?: { consolidated?: boolean | null } };
            })
          : null;
      const consolidatedFlag =
        typeof source?.consolidated === 'boolean'
          ? (source.consolidated as boolean)
          : typeof existingAkoma?.meta?.publication?.consolidated === 'boolean'
            ? (existingAkoma.meta?.publication?.consolidated as boolean)
            : null;

      const chunkTextSample = result.chunks
        .map((chunk) => (typeof chunk.content === 'string' ? chunk.content : '') ?? '')
        .join('\n')
        .slice(0, 8000);

      const derivedEli = source?.eli ?? deriveEliFromUrl(source?.source_url);
      const derivedEcli =
        source?.ecli ??
        deriveEcliFromUrl(source?.source_url) ??
        extractEcliFromText(chunkTextSample);

      const akomaPayload = {
        meta: {
          identification: {
            source: source?.publisher ?? null,
            jurisdiction: source?.jurisdiction_code ?? null,
            eli: derivedEli,
            ecli: derivedEcli,
            workURI: source?.source_url ?? null,
          },
          publication: {
            adoptionDate: source?.adopted_date ?? null,
            effectiveDate: source?.effective_date ?? null,
            capturedAt: nowIso,
            consolidated: consolidatedFlag,
            bindingLanguage: source?.binding_lang ?? null,
            languageNote: source?.language_note ?? null,
          },
        },
        body: {
          articles,
        },
      };

      const updates: Record<string, unknown> = {
        akoma_ntoso: akomaPayload,
      };

      if (derivedEli && !source?.eli) {
        updates.eli = derivedEli;
      }

      if (derivedEcli && !source?.ecli) {
        updates.ecli = derivedEcli;
      }

      const { error: akomaUpdateError } = await supabase
        .from('sources')
        .update(updates)
        .eq('id', document.source_id);

      if (akomaUpdateError) {
        request.log.warn({ err: akomaUpdateError }, 'akoma_ntoso_update_failed');
      }
    }
  }

  if (finalStatus === 'skipped') {
    await supabase.from('document_summaries').delete().eq('document_id', document.id);
    await supabase.from('document_chunks').delete().eq('document_id', document.id);
    const { error: skippedUpdate } = await supabase
      .from('documents')
      .update({
        summary_status: 'skipped',
        summary_generated_at: nowIso,
        summary_error: summaryError,
        chunk_count: 0,
      })
      .eq('id', document.id);

    if (skippedUpdate) {
      request.log.error({ err: skippedUpdate }, 'document skipped update failed');
    }
    chunkCount = 0;
  }

  if (finalStatus === 'failed') {
    await supabase
      .from('documents')
      .update({ summary_status: 'failed', summary_generated_at: nowIso, summary_error: summaryError })
      .eq('id', document.id);
  }

  const { data: updatedSummary } = await supabase
    .from('document_summaries')
    .select('summary, outline, created_at')
    .eq('document_id', document.id)
    .maybeSingle();

  try {
    await logAuditEvent({
      orgId,
      actorId: userHeader,
      kind: 'corpus.resummarize',
      object: document.id,
      after: {
        summary_status: finalStatus,
        chunk_count: chunkCount,
        summary_error: summaryError,
      },
    });
  } catch (error) {
    request.log.warn({ err: error }, 'resummarize audit failed');
  }

  return reply.send({
    documentId: document.id,
    summaryStatus: finalStatus,
    summaryGeneratedAt: nowIso,
    summaryError,
    chunkCount,
    summary: updatedSummary?.summary ?? null,
    highlights: Array.isArray(updatedSummary?.outline) ? updatedSummary?.outline : null,
  });
});

app.get<{
  Querystring: { orgId?: string; userId?: string; includeRevoked?: string; limit?: string };
}>(
  '/security/devices',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          orgId: { type: 'string' },
          userId: { type: 'string' },
          includeRevoked: { type: 'string' },
          limit: { type: 'string' },
        },
        required: ['orgId'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId, userId, includeRevoked, limit } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  const limitNumber = limit ? Number.parseInt(limit, 10) : 100;
  const resolvedLimit = Number.isFinite(limitNumber) ? Math.min(Math.max(limitNumber, 1), 500) : 100;
  const includeRevokedFlag = includeRevoked === 'true';
  const filterUserId = userId ? userId.trim() : undefined;

  try {
    if (filterUserId && filterUserId === userHeader) {
      await authorizeRequestWithGuards('workspace:view', orgId, userHeader, request);
    } else {
      await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
    }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'device_session_authorization_failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  try {
    const sessions = await listDeviceSessions(supabase, {
      orgId,
      userId: filterUserId,
      includeRevoked: includeRevokedFlag,
      limit: resolvedLimit,
    });

    return reply.send({
      sessions: sessions.map((session) => ({
        id: session.id,
        userId: session.user_id,
        sessionToken: session.session_token,
        deviceFingerprint: session.device_fingerprint,
        deviceLabel: session.device_label,
        userAgent: session.user_agent,
        platform: session.platform,
        clientVersion: session.client_version,
        ipAddress: session.ip_address,
        authStrength: session.auth_strength,
        mfaMethod: session.mfa_method,
        attested: session.attested,
        passkey: session.passkey,
        metadata: session.metadata,
        createdAt: session.created_at,
        lastSeenAt: session.last_seen_at,
        expiresAt: session.expires_at,
        revokedAt: session.revoked_at,
        revokedBy: session.revoked_by,
        revokedReason: session.revoked_reason,
      })),
    });
  } catch (error) {
    request.log.error({ err: error }, 'device_session_list_failed');
    return reply.code(500).send({ error: 'device_sessions_unavailable' });
  }
  },
);

app.post<{
  Body: { orgId?: string; sessionId?: string; reason?: string | null };
}>('/security/devices/revoke',
  { schema: { headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] } } },
  async (request, reply) => {
  const bodySchema = z.object({
    orgId: z.string().uuid(),
    sessionId: z.string().uuid(),
    reason: z.string().max(500).nullable().optional(),
  });
  const parsed = bodySchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_request_body', details: parsed.error.flatten() });
  }
  const { orgId, sessionId, reason } = parsed.data;

  if (!orgId || !sessionId) {
    return reply.code(400).send({ error: 'orgId and sessionId are required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('admin:security', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'device_session_revoke_authorization_failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  try {
    const revoked = await revokeDeviceSession(supabase, {
      orgId,
      sessionId,
      actorUserId: userHeader,
      reason: reason ?? null,
    });

    if (!revoked) {
      return reply.code(404).send({ error: 'device_session_not_found' });
    }

    return reply.send({
      session: {
        id: revoked.id,
        userId: revoked.user_id,
        sessionToken: revoked.session_token,
        revokedAt: revoked.revoked_at,
        revokedBy: revoked.revoked_by,
        revokedReason: revoked.revoked_reason,
      },
    });
  } catch (error) {
    request.log.error({ err: error }, 'device_session_revoke_failed');
    return reply.code(500).send({ error: 'device_session_revoke_failed' });
  }
  },
);

app.get<{
  Querystring: { orgId?: string; snapshotId?: string; compareTo?: string };
}>('/corpus/diff', async (request, reply) => {
  const querySchema = z.object({ orgId: z.string().uuid(), snapshotId: z.string().uuid(), compareTo: z.string().uuid() });
  const parsed = querySchema.safeParse(request.query ?? {});
  if (!parsed.success) {
    return reply.code(400).send({ error: 'invalid_query', details: parsed.error.flatten() });
  }
  const { orgId, snapshotId, compareTo } = parsed.data;

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('corpus:view', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'corpus diff authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  const { data, error } = await supabase
    .from('documents')
    .select('id, org_id, bucket_id, storage_path, name, created_at, mime_type')
    .in('id', [snapshotId, compareTo]);

  if (error) {
    request.log.error({ err: error }, 'documents fetch failed');
    return reply.code(500).send({ error: 'documents_unavailable' });
  }

  const docs = data ?? [];
  if (docs.length < 2) {
    return reply.code(404).send({ error: 'snapshots_not_found' });
  }

  const baseDoc = docs.find((doc) => doc.id === snapshotId);
  const compareDoc = docs.find((doc) => doc.id === compareTo);

  if (!baseDoc || !compareDoc || baseDoc.org_id !== orgId || compareDoc.org_id !== orgId) {
    return reply.code(403).send({ error: 'forbidden' });
  }

  async function downloadText(bucket: string, path: string) {
    const { data: blob, error: storageError } = await supabase.storage.from(bucket).download(path);
    if (storageError || !blob) {
      return { content: '', warning: 'Contenu indisponible pour comparaison.' };
    }
    const text = await (blob as Blob).text().catch(() => null);
    if (!text) {
      return { content: '', warning: 'Document binaire : diff indisponible.' };
    }
    return { content: text, warning: null };
  }

  const [baseContent, compareContent] = await Promise.all([
    downloadText(baseDoc.bucket_id, baseDoc.storage_path),
    downloadText(compareDoc.bucket_id, compareDoc.storage_path),
  ]);

  const diff = diffWordsWithSpace(baseContent.content, compareContent.content).map((part) => ({
    value: part.value,
    added: Boolean(part.added),
    removed: Boolean(part.removed),
  }));

  return {
    base: {
      id: baseDoc.id,
      name: baseDoc.name,
      createdAt: baseDoc.created_at,
      warning: baseContent.warning,
    },
    compare: {
      id: compareDoc.id,
      name: compareDoc.name,
      createdAt: compareDoc.created_at,
      warning: compareContent.warning,
    },
    diff,
  };
});

app.patch<{ Params: { host: string }; Body: { active?: boolean; jurisdiction?: string } }>(
  '/corpus/allowlist/:host',
  async (request, reply) => {
    const { host } = request.params;
    const { active, jurisdiction } = request.body ?? {};
    if (typeof active !== 'boolean') {
      return reply.code(400).send({ error: 'active flag required' });
    }

    const userHeader = request.headers['x-user-id'];
    const orgHeader = request.headers['x-org-id'];
    if (!userHeader || typeof userHeader !== 'string' || !orgHeader || typeof orgHeader !== 'string') {
      return reply
        .code(400)
        .send({ error: 'x-user-id and x-org-id headers are required for allowlist updates' });
    }

    try {
      await authorizeRequestWithGuards('corpus:manage', orgHeader, userHeader, request);
    } catch (error) {
      if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
        return reply.code(error.statusCode).send({ error: error.message });
      }
      request.log.error({ err: error }, 'allowlist authorization failed');
      return reply.code(403).send({ error: 'forbidden' });
    }

    let lookupBuilder = supabase
      .from('authority_domains')
      .select('host, jurisdiction_code, active')
      .eq('host', host);
    if (jurisdiction) {
      lookupBuilder = lookupBuilder.eq('jurisdiction_code', jurisdiction);
    }
    const before = await lookupBuilder.limit(1).maybeSingle();

    let updateBuilder = supabase
      .from('authority_domains')
      .update({ active })
      .eq('host', host);
    if (jurisdiction) {
      updateBuilder = updateBuilder.eq('jurisdiction_code', jurisdiction);
    }

    const update = await updateBuilder
      .select('host, jurisdiction_code, active')
      .maybeSingle();

    if (update.error) {
      request.log.error({ err: update.error }, 'allowlist toggle failed');
      return reply.code(500).send({ error: 'allowlist_failed' });
    }

    try {
      await logAuditEvent({
        orgId: orgHeader,
        actorId: userHeader,
        kind: 'allowlist.updated',
        object: host,
        before: before.data ?? undefined,
        after: update.data ?? undefined,
      });
    } catch (error) {
      request.log.warn({ err: error }, 'allowlist audit failed');
    }

    return { host, active };
  },
);

app.get<{
  Querystring: { orgId?: string; query?: string; jurisdiction?: string };
}>(
  '/search-hybrid',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: { orgId: { type: 'string' }, query: { type: 'string' }, jurisdiction: { type: 'string' } },
        required: ['orgId', 'query'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId, query, jurisdiction } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  if (!query) {
    return reply.code(400).send({ error: 'query is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('search-hybrid', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'hybrid search authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  try {
    const results = await getHybridRetrievalContext(orgId, query, jurisdiction ?? null);
    return {
      results: results.map((item) => ({
        content: item.content,
        similarity: item.similarity,
        weight: item.weight,
        origin: item.origin,
        sourceId: item.sourceId ?? null,
        documentId: item.documentId ?? null,
        fileId: item.fileId ?? null,
        url: item.url ?? null,
        title: item.title ?? null,
        publisher: item.publisher ?? null,
        trustTier: item.trustTier ?? null,
      })),
    };
  } catch (error) {
    request.log.error({ err: error }, 'hybrid search failed');
    return reply.code(502).send({ error: 'hybrid_search_failed' });
  }
  },
);

app.get<{
  Querystring: { orgId?: string; query?: string; jurisdiction?: string; limit?: string };
}>(
  '/search-local',
  {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          orgId: { type: 'string' },
          query: { type: 'string' },
          jurisdiction: { type: 'string' },
          limit: { type: 'string' },
        },
        required: ['orgId', 'query'],
      },
      headers: { type: 'object', properties: { 'x-user-id': { type: 'string' } }, required: ['x-user-id'] },
    },
  },
  async (request, reply) => {
  const { orgId, query, jurisdiction, limit } = request.query;

  if (!orgId) {
    return reply.code(400).send({ error: 'orgId is required' });
  }

  if (!query) {
    return reply.code(400).send({ error: 'query is required' });
  }

  const userHeader = request.headers['x-user-id'];
  if (!userHeader || typeof userHeader !== 'string') {
    return reply.code(400).send({ error: 'x-user-id header is required' });
  }

  try {
    await authorizeRequestWithGuards('search-local', orgId, userHeader, request);
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
      return reply.code(error.statusCode).send({ error: error.message });
    }
    request.log.error({ err: error }, 'local search authorization failed');
    return reply.code(403).send({ error: 'forbidden' });
  }

  try {
    const embedding = await embedQuery(query);
    const matchCount = limit ? Math.min(Math.max(Number.parseInt(limit, 10) || 0, 1), 20) : 8;

    const { data, error } = await supabase.rpc('match_chunks', {
      p_org: orgId,
      p_query_embedding: embedding,
      p_match_count: matchCount,
      p_jurisdiction: jurisdiction ?? null,
    });

    if (error) {
      request.log.error({ err: error }, 'match_chunks rpc failed');
      return reply.code(500).send({ error: 'search_failed' });
    }

    return {
      matches: (data ?? []).map((entry: any) => ({
        id: entry.chunk_id,
        documentId: entry.document_id,
        jurisdiction: entry.jurisdiction_code,
        content: entry.content,
        similarity: entry.similarity,
      })),
    };
  } catch (error) {
    request.log.error({ err: error }, 'local search failed');
    return reply.code(502).send({ error: 'embedding_failed' });
  }
  },
);

if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

export { app };

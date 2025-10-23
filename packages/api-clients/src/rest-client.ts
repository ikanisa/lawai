import {
  AgentPlanNotice,
  AgentPlanStep,
  IRACPayload,
  ProcessNavigatorFlow,
  WorkspaceDesk,
} from '@avocat-ai/shared';

export interface RestClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  defaultHeaders?: HeadersInit;
}

interface InternalRestConfig {
  baseUrl: string;
  fetchImpl: typeof globalThis.fetch;
  defaultHeaders?: HeadersInit;
}

let restConfig: InternalRestConfig | null = null;

export const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

export function createRestClient(options: RestClientOptions): RestApiClient {
  restConfig = {
    baseUrl: normalizeBaseUrl(options.baseUrl),
    fetchImpl: options.fetch ?? globalThis.fetch.bind(globalThis),
    defaultHeaders: options.defaultHeaders,
  };

  return restApiClient;
}

export function getRestClient(): RestApiClient {
  getRestConfig();
  return restApiClient;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function getRestConfig(): InternalRestConfig {
  if (!restConfig) {
    throw new Error('REST client not configured. Call configureRestClient() before invoking operations.');
  }

  return restConfig;
}

function apiBase(): string {
  return getRestConfig().baseUrl;
}

function resolveUrl(path: string | URL): string {
  if (path instanceof URL) {
    return path.toString();
  }

  if (/^https?:/i.test(path)) {
    return path;
  }

  const base = apiBase();
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function mergeHeaders(defaultHeaders?: HeadersInit, override?: HeadersInit): Headers {
  const headers = new Headers();

  if (defaultHeaders) {
    new Headers(defaultHeaders).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  if (override) {
    new Headers(override).forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}

async function configuredFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const config = getRestConfig();
  const headers = mergeHeaders(config.defaultHeaders, init.headers);

  return config.fetchImpl(resolveUrl(input), { ...init, headers });
}

export type VerificationSeverity = 'info' | 'warning' | 'critical';

export interface VerificationNote {
  code: string;
  message: string;
  severity: VerificationSeverity;
}

export type VerificationStatus = 'passed' | 'hitl_escalated';

export interface VerificationResult {
  status: VerificationStatus;
  notes: VerificationNote[];
  allowlistViolations: string[];
}

export interface TrustPanelCitationSummary {
  total: number;
  allowlisted: number;
  ratio: number;
  nonAllowlisted: Array<{ title: string | null; url: string }>;
  translationWarnings: string[];
  bindingNotes: Record<string, number>;
  rules: { total: number; binding: number; nonBinding: number };
}

export interface TrustPanelCaseQualitySummary {
  items: Array<{
    url: string;
    score: number;
    hardBlock: boolean;
    notes: string[];
    axes: Record<string, number>;
  }>;
  minScore: number | null;
  maxScore: number | null;
  forceHitl: boolean;
}

export interface TrustPanelRetrievalSummary {
  snippetCount: number;
  fileSearch: number;
  local: number;
  topHosts: Array<{ host: string; count: number }>;
}

export interface TrustPanelProvenanceSummary {
  totalSources: number;
  withEli: number;
  withEcli: number;
  residencyBreakdown: Array<{ zone: string; count: number }>;
  bindingLanguages: Array<{ language: string; count: number }>;
  akomaArticles: number;
}

export interface TrustPanelRiskSummary {
  level: IRACPayload['risk']['level'];
  hitlRequired: boolean;
  reason: string;
  verification: VerificationResult;
}

export interface TrustPanelPayload {
  citationSummary: TrustPanelCitationSummary;
  retrievalSummary: TrustPanelRetrievalSummary;
  caseQuality: TrustPanelCaseQualitySummary;
  risk: TrustPanelRiskSummary;
  provenance: TrustPanelProvenanceSummary;
}

export interface RetrievalMetricsResponse {
  summary: {
    runsTotal: number;
    avgLocalSnippets: number | null;
    avgFileSnippets: number | null;
    allowlistedRatio: number | null;
    runsWithTranslationWarnings: number;
    runsWithoutCitations: number;
    lastRunAt: string | null;
  } | null;
  origins: Array<{
    origin: string;
    snippetCount: number;
    avgSimilarity: number | null;
    avgWeight: number | null;
  }>;
  hosts: Array<{
    host: string;
    citationCount: number;
    allowlistedCount: number;
    translationWarnings: number;
    lastCitedAt: string | null;
  }>;
}

export interface AgentRunResponse {
  runId: string;
  data: IRACPayload;
  toolLogs?: Array<{ name: string; args: unknown; output: unknown }>;
  plan?: AgentPlanStep[];
  notices?: AgentPlanNotice[];
  reused?: boolean;
  verification?: VerificationResult | null;
  trustPanel?: TrustPanelPayload | null;
}

export interface HitlMetricsResponse {
  orgId: string;
  metrics: {
    queue: {
      reportDate: string | null;
      pending: number;
      byType: Record<string, number>;
      oldestCreatedAt: string | null;
      capturedAt: string | null;
    } | null;
    drift: {
      reportDate: string | null;
      totalRuns: number;
      highRiskRuns: number;
      hitlEscalations: number;
      allowlistedRatio: number | null;
    } | null;
    fairness: {
      reportDate: string | null;
      overall?: Record<string, unknown> | null;
      capturedAt: string | null;
      jurisdictions: Array<Record<string, unknown>>;
      benchmarks: Array<Record<string, unknown>>;
      flagged: { jurisdictions: string[]; benchmarks: string[] };
      trend?: Array<{
        reportDate: string | null;
        capturedAt: string | null;
        windowStart: string | null;
        windowEnd: string | null;
        overall: Record<string, unknown> | null;
        jurisdictions: Array<Record<string, unknown>>;
        benchmarks: Array<Record<string, unknown>>;
        flagged: { jurisdictions: string[]; benchmarks: string[] };
      }>;
    } | null;
  };
}

export interface HitlDetailResponse {
  hitl: {
    id: string;
    reason: string;
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
    resolutionMinutes?: number | null;
    resolutionBucket?: string | null;
    reviewerComment?: string | null;
  };
  run: {
    id: string;
    orgId: string | null;
    question: string;
    jurisdiction: string | null;
    irac: IRACPayload | null;
    riskLevel: string | null;
    status: string | null;
    hitlRequired: boolean | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  } | null;
  citations: Array<{
    title?: string | null;
    publisher?: string | null;
    url: string;
    domainOk?: boolean | null;
    note?: string | null;
  }>;
  retrieval: Array<{
    id: string;
    origin: string | null;
    snippet: string | null;
    similarity: number | null;
    weight: number | null;
    metadata: Record<string, unknown>;
  }>;
  edits: Array<{
    id: string;
    action: string | null;
    comment: string | null;
    reviewerId: string | null;
    createdAt?: string | null;
    previousPayload: IRACPayload | null;
    revisedPayload: IRACPayload | null;
  }>;
}

export interface SloSnapshot {
  captured_at: string;
  api_uptime_percent: number | null;
  hitl_response_p95_seconds: number | null;
  retrieval_latency_p95_seconds: number | null;
  citation_precision_p95: number | null;
  notes?: string | null;
}

export interface SloSummary {
  snapshots: number;
  latestCapture: string | null;
  apiUptimeP95: number | null;
  hitlResponseP95Seconds: number | null;
  retrievalLatencyP95Seconds: number | null;
  citationPrecisionP95: number | null;
}

export interface SloMetricsResponse {
  summary: SloSummary | null;
  snapshots: SloSnapshot[];
}

export interface OperationsSloSnapshot {
  capturedAt: string | null;
  apiUptimePercent: number | null;
  hitlResponseP95Seconds: number | null;
  retrievalLatencyP95Seconds: number | null;
  citationPrecisionP95: number | null;
  notes: string | null;
}

export interface OperationsSloSummary {
  snapshots: number | null;
  latestCapture: string | null;
  apiUptimeP95: number | null;
  hitlResponseP95Seconds: number | null;
  retrievalLatencyP95Seconds: number | null;
  citationPrecisionP95: number | null;
}

export interface OperationsIncident {
  id: string;
  occurredAt: string | null;
  detectedAt: string | null;
  resolvedAt: string | null;
  severity: string;
  status: string;
  title: string;
  summary: string;
  impact: string;
  resolution: string;
  followUp: string;
  evidenceUrl: string | null;
  recordedAt: string | null;
}

export interface OperationsChangeLogEntry {
  id: string;
  entryDate: string | null;
  title: string;
  category: string;
  summary: string;
  releaseTag: string | null;
  links: unknown;
  recordedAt: string | null;
}

export interface OperationsGoNoGoCriterion {
  criterion: string;
  autoSatisfied: boolean;
  recommendedEvidenceUrl: string | null;
  recordedStatus: string;
  recordedEvidenceUrl: string | null;
  recordedNotes: unknown;
}

export interface LaunchDigestEntry {
  id: string;
  orgId: string;
  requestedBy: string;
  jurisdiction: string;
  channel: string;
  frequency: string;
  recipients: string[];
  topics?: string[];
  createdAt: string;
}

export interface DispatchRecord {
  id: string;
  report_type: string | null;
  period_start: string;
  period_end: string;
  status: string | null;
  payload_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  dispatched_at: string | null;
}

export interface OperationsOverviewResponse {
  slo: {
    summary: OperationsSloSummary | null;
    snapshots: OperationsSloSnapshot[];
  };
  incidents: {
    total: number;
    open: number;
    closed: number;
    latest: OperationsIncident | null;
    entries: OperationsIncident[];
  };
  changeLog: {
    total: number;
    latest: OperationsChangeLogEntry | null;
    entries: OperationsChangeLogEntry[];
  };
  goNoGo: {
    section: string;
    criteria: OperationsGoNoGoCriterion[];
  };
}

export interface ComplianceAcknowledgements {
  consent: {
    requiredVersion: string | null;
    acknowledgedVersion: string | null;
    acknowledgedAt: string | null;
    satisfied: boolean;
  };
  councilOfEurope: {
    requiredVersion: string | null;
    acknowledgedVersion: string | null;
    acknowledgedAt: string | null;
    satisfied: boolean;
  };
}

export interface ComplianceAssessmentSummary {
  fria: {
    required: boolean;
    reasons: string[];
  };
  cepej: {
    passed: boolean;
    violations: string[];
  };
  statute: {
    passed: boolean;
    violations: string[];
  };
  disclosures: {
    consentSatisfied: boolean;
    councilSatisfied: boolean;
    missing: string[];
    requiredConsentVersion: string | null;
    acknowledgedConsentVersion: string | null;
    requiredCoeVersion: string | null;
    acknowledgedCoeVersion: string | null;
  };
}

export interface ComplianceStatusEntry {
  runId: string | null;
  createdAt: string | null;
  assessment: ComplianceAssessmentSummary;
}

export interface ComplianceStatusResponse {
  orgId: string;
  userId: string;
  acknowledgements: ComplianceAcknowledgements;
  latest: ComplianceStatusEntry | null;
  history: ComplianceStatusEntry[];
  totals: {
    total: number;
    friaRequired: number;
    cepejViolations: number;
    statuteViolations: number;
    disclosureGaps: number;
  };
}

export interface DeviceSession {
  id: string;
  userId: string;
  sessionToken: string;
  deviceFingerprint: string;
  deviceLabel: string | null;
  userAgent: string | null;
  platform: string | null;
  clientVersion: string | null;
  ipAddress: string | null;
  authStrength: string | null;
  mfaMethod: string | null;
  attested: boolean | null;
  passkey: boolean | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revokedReason: string | null;
}

export interface AuditEvent {
  id: string;
  kind: string;
  object: string;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  actor_user_id?: string | null;
}

export async function submitResearchQuestion(input: {
  question: string;
  context?: string;
  orgId: string;
  userId: string;
  confidentialMode?: boolean;
}): Promise<AgentRunResponse> {
  const response = await configuredFetch(`${apiBase()}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message =
      typeof errorBody?.message === 'string'
        ? errorBody.message
        : typeof errorBody?.error === 'string'
          ? errorBody.error
          : 'agent_unavailable';
    throw new Error(message);
  }

  return response.json();
}

export async function requestHitlReview(
  runId: string,
  input: { reason: string; manual?: boolean; orgId?: string; userId?: string },
): Promise<void> {
  const response = await configuredFetch(`${apiBase()}/runs/${encodeURIComponent(runId)}/hitl`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orgId: input.orgId ?? DEMO_ORG_ID,
      userId: input.userId ?? DEMO_USER_ID,
      reason: input.reason,
      manual: input.manual ?? true,
    }),
  });

  if (!response.ok) {
    throw new Error('Unable to request human review');
  }
}

export async function sendTelemetryEvent(
  eventName: string,
  payload?: Record<string, unknown>,
  orgId: string = DEMO_ORG_ID,
  userId: string = DEMO_USER_ID,
): Promise<void> {
  try {
    await configuredFetch(`${apiBase()}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, userId, eventName, payload }),
    });
  } catch (error) {
    console.warn('telemetry_event_failed', eventName, error);
  }
}

export async function fetchCitations(orgId: string) {
  const response = await configuredFetch(`${apiBase()}/citations?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch citations');
  }
  return response.json();
}

export async function fetchHitlQueue(orgId: string) {
  const response = await configuredFetch(`${apiBase()}/hitl?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch HITL queue');
  }
  return response.json();
}

export async function fetchHitlMetrics(orgId: string): Promise<HitlMetricsResponse> {
  const response = await configuredFetch(`${apiBase()}/hitl/metrics?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch HITL metrics');
  }
  return response.json();
}

export async function fetchHitlDetail(orgId: string, id: string): Promise<HitlDetailResponse> {
  const response = await configuredFetch(`${apiBase()}/hitl/${encodeURIComponent(id)}?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch HITL detail');
  }
  return response.json();
}

export async function submitHitlAction(id: string, action: 'approve' | 'request_changes' | 'reject', comment?: string) {
  const response = await configuredFetch(`${apiBase()}/hitl/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, comment }),
  });
  if (!response.ok) {
    throw new Error('Unable to update review status');
  }
  return response.json();
}

export async function fetchMatters(orgId: string) {
  const response = await configuredFetch(`${apiBase()}/matters?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch matters');
  }
  return response.json();
}

export async function fetchMatterDetail(orgId: string, id: string) {
  const response = await configuredFetch(
    `${apiBase()}/matters/${encodeURIComponent(id)}?orgId=${encodeURIComponent(orgId)}`,
  );
  if (!response.ok) {
    throw new Error('Unable to fetch matter');
  }
  return response.json();
}

export async function fetchHitlAuditTrail(
  orgId: string,
  options: { runId?: string; objectId?: string; limit?: number },
) {
  const url = new URL(`${apiBase()}/admin/org/${orgId}/audit-events`);
  if (options.limit) {
    url.searchParams.set('limit', String(options.limit));
  }
  if (options.objectId) {
    url.searchParams.set('object', options.objectId);
  }
  if (options.runId) {
    url.searchParams.set('runId', options.runId);
  }

  const response = await configuredFetch(url.toString(), {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch audit events');
  }
  return response.json() as Promise<{ events: AuditEvent[] }>;
}

export async function fetchCorpus(orgId: string) {
  const response = await configuredFetch(`${apiBase()}/corpus?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch corpus overview');
  }
  return response.json();
}

export async function resummarizeDocument(
  orgId: string,
  documentId: string,
  overrides?: { summariserModel?: string; embeddingModel?: string; maxSummaryChars?: number },
) {
  const response = await configuredFetch(`${apiBase()}/corpus/${encodeURIComponent(documentId)}/resummarize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': DEMO_USER_ID,
    },
    body: JSON.stringify({ orgId, ...overrides }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error ?? 'Unable to resummarize document');
  }

  return response.json();
}

export interface GovernanceMetricsResponse {
  overview: {
    orgId: string;
    orgName: string;
    totalRuns: number;
    runsLast30Days: number;
    highRiskRuns: number;
    confidentialRuns: number;
    avgLatencyMs: number;
    allowlistedCitationRatio: number | null;
    hitlPending: number;
    hitlMedianResponseMinutes: number | null;
    ingestionSuccessLast7Days: number;
    ingestionFailedLast7Days: number;
    evaluationCases: number;
    evaluationPassRate: number | null;
    documentsTotal: number;
    documentsReady: number;
    documentsPending: number;
    documentsFailed: number;
    documentsSkipped: number;
    documentsChunked: number;
  } | null;
  manifest: {
    manifestName: string | null;
    manifestUrl: string | null;
    fileCount: number;
    validCount: number;
    warningCount: number;
    errorCount: number;
    validated: boolean;
    createdAt: string | null;
    status?: 'ok' | 'warnings' | 'errors' | null;
  } | null;
  tools: Array<{
    toolName: string;
    totalInvocations: number;
    successCount: number;
    failureCount: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    lastInvokedAt: string | null;
  }>;
  identifiers: Array<{
    jurisdiction: string;
    sourcesTotal: number;
    sourcesWithEli: number;
    sourcesWithEcli: number;
    sourcesWithAkoma: number;
    akomaArticles: number;
  }>;
  jurisdictions: Array<{
    jurisdiction: string;
    residencyZone: string;
    totalSources: number;
    sourcesConsolidated: number;
    sourcesWithBinding: number;
    sourcesWithLanguageNote: number;
    sourcesWithEli: number;
    sourcesWithEcli: number;
    sourcesWithAkoma: number;
    bindingBreakdown: Record<string, number>;
    sourceTypeBreakdown: Record<string, number>;
    languageNoteBreakdown: Record<string, number>;
  }>;
}

export async function fetchGovernanceMetrics(orgId: string, userId: string = DEMO_USER_ID): Promise<GovernanceMetricsResponse> {
  const response = await configuredFetch(`${apiBase()}/metrics/governance?orgId=${encodeURIComponent(orgId)}`, {
    headers: {
      'x-user-id': userId,
    },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch governance metrics');
  }
  return response.json();
}

export async function fetchRetrievalMetrics(orgId: string, userId: string = DEMO_USER_ID): Promise<RetrievalMetricsResponse> {
  const response = await configuredFetch(`${apiBase()}/metrics/retrieval?orgId=${encodeURIComponent(orgId)}`, {
    headers: {
      'x-user-id': userId,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to fetch retrieval metrics');
  }

  return response.json();
}

export interface EvaluationMetricsResponse {
  summary: {
    totalCases: number;
    evaluatedResults: number;
    passRate: number | null;
    citationPrecisionP95: number | null;
    temporalValidityP95: number | null;
    citationPrecisionCoverage: number | null;
    temporalValidityCoverage: number | null;
    maghrebBannerCoverage: number | null;
    lastResultAt: string | null;
  } | null;
  jurisdictions: Array<{
    jurisdiction: string;
    evaluationCount: number;
    passRate: number | null;
    citationPrecisionMedian: number | null;
    temporalValidityMedian: number | null;
    avgBindingWarnings: number | null;
    maghrebBannerCoverage: number | null;
  }>;
}

export async function fetchEvaluationMetrics(orgId: string, userId: string = DEMO_USER_ID): Promise<EvaluationMetricsResponse> {
  const response = await configuredFetch(`${apiBase()}/metrics/evaluations?orgId=${encodeURIComponent(orgId)}`, {
    headers: {
      'x-user-id': userId,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to fetch evaluation metrics');
  }

  return response.json();
}

export async function fetchSloMetrics(orgId: string, limit = 6, userId: string = DEMO_USER_ID): Promise<SloMetricsResponse> {
  const params = new URLSearchParams({ orgId, limit: String(limit) });
  const response = await configuredFetch(`${apiBase()}/metrics/slo?${params.toString()}`, {
    headers: {
      'x-user-id': userId,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to fetch SLO metrics');
  }

  return response.json();
}

export async function listSloSnapshots(input: {
  orgId: string;
  userId: string;
  format?: 'json' | 'csv';
}): Promise<unknown> {
  const basePath = input.format === 'csv' ? '/metrics/slo/export' : '/metrics/slo';
  const params = new URLSearchParams({ orgId: input.orgId });
  if (input.format === 'csv') {
    params.set('format', 'csv');
  }

  const response = await configuredFetch(`${apiBase()}${basePath}?${params.toString()}`, {
    headers: {
      'x-user-id': input.userId,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to list SLO snapshots (${response.status}): ${body}`);
  }

  return input.format === 'csv' ? response.text() : response.json();
}

export async function createSloSnapshot(input: {
  orgId: string;
  userId: string;
  apiUptimePercent: number | null;
  hitlResponseP95Seconds: number | null;
  retrievalLatencyP95Seconds: number | null;
  citationPrecisionP95: number | null;
  notes?: string | null;
}): Promise<unknown> {
  const payload = {
    orgId: input.orgId,
    apiUptimePercent: input.apiUptimePercent,
    hitlResponseP95Seconds: input.hitlResponseP95Seconds,
    retrievalLatencyP95Seconds: input.retrievalLatencyP95Seconds,
    citationPrecisionP95: input.citationPrecisionP95,
    notes: input.notes ?? null,
  };

  const response = await configuredFetch(`${apiBase()}/metrics/slo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to create SLO snapshot (${response.status}): ${body}`);
  }

  return response.json();
}

export async function fetchSnapshotDiff(orgId: string, snapshotId: string, compareTo: string) {
  const params = new URLSearchParams({ orgId, snapshotId, compareTo });
  const response = await configuredFetch(`${apiBase()}/corpus/diff?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Unable to compute diff');
  }
  return response.json();
}

export async function toggleAllowlistDomain(host: string, active: boolean, jurisdiction?: string) {
  const response = await configuredFetch(`${apiBase()}/corpus/allowlist/${encodeURIComponent(host)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active, jurisdiction }),
  });
  if (!response.ok) {
    throw new Error('Unable to toggle domain');
  }
  return response.json();
}

export interface SsoConnectionResponse {
  connections: Array<{
    id: string;
    provider: 'saml' | 'oidc';
    label: string | null;
    acsUrl: string | null;
    entityId: string | null;
    defaultRole: string;
    createdAt: string;
  }>;
}

export async function fetchSsoConnections(orgId: string): Promise<SsoConnectionResponse> {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/sso`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch SSO connections');
  }
  return response.json();
}

export async function saveSsoConnection(
  orgId: string,
  input: {
    id?: string;
    provider: 'saml' | 'oidc';
    label?: string;
    acsUrl?: string;
    entityId?: string;
    defaultRole?: string;
  },
) {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/sso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
    body: JSON.stringify({ ...input, metadata: {}, groupMappings: {} }),
  });
  if (!response.ok) {
    throw new Error('Unable to save SSO connection');
  }
  return response.json();
}

export async function removeSsoConnection(orgId: string, connectionId: string) {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/sso/${connectionId}`, {
    method: 'DELETE',
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to delete SSO connection');
  }
}

export interface ScimTokenResponse {
  id: string;
  token: string;
  expiresAt?: string | null;
}

export async function fetchScimTokens(orgId: string) {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/scim-tokens`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch SCIM tokens');
  }
  return response.json();
}

export async function createScimAccessToken(orgId: string, name: string, expiresAt?: string | null) {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/scim-tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
    body: JSON.stringify({ name, expiresAt }),
  });
  if (!response.ok) {
    throw new Error('Unable to create SCIM token');
  }
  return response.json() as Promise<ScimTokenResponse>;
}

export async function deleteScimAccessToken(orgId: string, tokenId: string) {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/scim-tokens/${tokenId}`, {
    method: 'DELETE',
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to delete SCIM token');
  }
}

export async function fetchComplianceStatus(
  orgId: string,
  options?: { userId?: string; limit?: number },
): Promise<ComplianceStatusResponse> {
  const params = new URLSearchParams();
  if (options?.limit) {
    params.set('limit', String(options.limit));
  }
  const response = await configuredFetch(`${apiBase()}/compliance/status?${params.toString()}`, {
    headers: {
      'x-user-id': options?.userId ?? DEMO_USER_ID,
      'x-org-id': orgId,
    },
  });
  if (!response.ok) {
    throw new Error('compliance_status_failed');
  }
  return response.json();
}

export async function acknowledgeCompliance(
  orgId: string,
  input: {
    consent?: { type: string; version: string } | null;
    councilOfEurope?: { version: string } | null;
    userId?: string;
  },
): Promise<ComplianceStatusResponse> {
  const payload: Record<string, unknown> = {};
  if (input.consent) {
    payload.consent = input.consent;
  }
  if (input.councilOfEurope) {
    payload.councilOfEurope = input.councilOfEurope;
  }
  const response = await configuredFetch(`${apiBase()}/compliance/acknowledgements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId ?? DEMO_USER_ID,
      'x-org-id': orgId,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('compliance_ack_failed');
  }
  return response.json();
}

export async function fetchAuditEvents(orgId: string, limit = 50) {
  const response = await configuredFetch(
    `${apiBase()}/admin/org/${orgId}/audit-events?limit=${encodeURIComponent(String(limit))}`,
    { headers: { 'x-user-id': DEMO_USER_ID } },
  );
  if (!response.ok) {
    throw new Error('Unable to fetch audit events');
  }
  return response.json();
}

export async function fetchDeviceSessions(
  orgId: string,
  options?: { includeRevoked?: boolean; limit?: number; userId?: string },
): Promise<{ sessions: DeviceSession[] }> {
  const params = new URLSearchParams({ orgId });
  if (options?.includeRevoked) params.set('includeRevoked', 'true');
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.userId) params.set('userId', options.userId);

  const response = await configuredFetch(`${apiBase()}/security/devices?${params.toString()}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch device sessions');
  }

  const payload = (await response.json()) as { sessions: Array<Record<string, unknown>> };
  const sessions = (payload.sessions ?? []).map((session) => ({
    id: String(session.id ?? ''),
    userId: String(session.userId ?? ''),
    sessionToken: String(session.sessionToken ?? ''),
    deviceFingerprint: String(session.deviceFingerprint ?? ''),
    deviceLabel: (session.deviceLabel as string | null) ?? null,
    userAgent: (session.userAgent as string | null) ?? null,
    platform: (session.platform as string | null) ?? null,
    clientVersion: (session.clientVersion as string | null) ?? null,
    ipAddress: (session.ipAddress as string | null) ?? null,
    authStrength: (session.authStrength as string | null) ?? null,
    mfaMethod: (session.mfaMethod as string | null) ?? null,
    attested: (session.attested as boolean | null) ?? null,
    passkey: (session.passkey as boolean | null) ?? null,
    metadata: (session.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(session.createdAt ?? session.created_at ?? ''),
    lastSeenAt: String(session.lastSeenAt ?? session.last_seen_at ?? ''),
    expiresAt: (session.expiresAt as string | null) ?? null,
    revokedAt: (session.revokedAt as string | null) ?? null,
    revokedBy: (session.revokedBy as string | null) ?? null,
    revokedReason: (session.revokedReason as string | null) ?? null,
  })) as DeviceSession[];

  return { sessions };
}

export async function revokeDeviceSession(orgId: string, sessionId: string, reason?: string) {
  const response = await configuredFetch(`${apiBase()}/security/devices/revoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': DEMO_USER_ID,
    },
    body: JSON.stringify({ orgId, sessionId, reason: reason ?? null }),
  });

  if (!response.ok) {
    throw new Error('Unable to revoke device session');
  }

  return response.json() as Promise<{ session: { id: string; revokedAt: string } }>;
}

export async function fetchIpAllowlist(orgId: string) {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/ip-allowlist`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch IP allowlist');
  }
  return response.json();
}

export async function upsertIpAllowlistEntry(
  orgId: string,
  input: { id?: string; cidr: string; description?: string | null },
) {
  const url = input.id
    ? `${apiBase()}/admin/org/${orgId}/ip-allowlist/${input.id}`
    : `${apiBase()}/admin/org/${orgId}/ip-allowlist`;
  const method = input.id ? 'PATCH' : 'POST';
  const response = await configuredFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
    body: JSON.stringify({ cidr: input.cidr, description: input.description ?? null }),
  });
  if (!response.ok) {
    throw new Error('Unable to save IP entry');
  }
  return response.json();
}

export async function deleteIpAllowlistEntry(orgId: string, entryId: string) {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/ip-allowlist/${entryId}`, {
    method: 'DELETE',
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to delete IP entry');
  }
}

export async function fetchDraftingTemplates(orgId: string, params?: { jurisdiction?: string; matterType?: string }) {
  const search = new URLSearchParams({ orgId });
  if (params?.jurisdiction) {
    search.set('jurisdiction', params.jurisdiction);
  }
  if (params?.matterType) {
    search.set('matterType', params.matterType);
  }
  const response = await configuredFetch(`${apiBase()}/drafting/templates?${search.toString()}`);
  if (!response.ok) {
    throw new Error('Unable to fetch templates');
  }
  return response.json();
}

export interface WorkspaceOverviewResponse {
  jurisdictions: Array<{ code: string; name: string; eu: boolean; ohada: boolean; matterCount: number }>;
  matters: Array<{
    id: string;
    question: string;
    status: string | null;
    riskLevel: string | null;
    hitlRequired: boolean | null;
    startedAt: string | null;
    finishedAt: string | null;
    jurisdiction: string | null;
  }>;
  complianceWatch: Array<{
    id: string;
    title: string;
    publisher: string | null;
    url: string;
    jurisdiction: string | null;
    consolidated: boolean | null;
    effectiveDate: string | null;
    createdAt: string | null;
  }>;
  hitlInbox: {
    items: Array<{ id: string; runId: string; reason: string; status: string; createdAt: string | null }>;
    pendingCount: number;
  };
  desk?: WorkspaceDesk;
  navigator?: ProcessNavigatorFlow[];
}

export async function fetchWorkspaceOverview(orgId: string): Promise<WorkspaceOverviewResponse> {
  const response = await configuredFetch(`${apiBase()}/workspace?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch workspace overview');
  }
  return response.json();
}

export async function getOperationsOverview(orgId: string): Promise<OperationsOverviewResponse> {
  const response = await configuredFetch(`${apiBase()}/admin/org/${orgId}/operations/overview`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch operations overview');
  }
  return response.json();
}

export interface GovernancePublication {
  slug: string;
  title: string;
  summary: string | null;
  doc_url: string | null;
  category: string | null;
  status: string;
  published_at: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface GovernancePublicationsResponse {
  publications: GovernancePublication[];
}

export async function getGovernancePublications(params?: {
  status?: string;
  category?: string;
  orgId?: string;
}): Promise<GovernancePublicationsResponse> {
  const search = new URLSearchParams();
  if (params?.status) {
    search.set('status', params.status);
  }
  if (params?.category) {
    search.set('category', params.category);
  }
  if (params?.orgId) {
    search.set('orgId', params.orgId);
  }

  const headers: Record<string, string> = {};
  if (params?.orgId) {
    headers['x-user-id'] = DEMO_USER_ID;
  }

  const query = search.toString();
  const url = query ? `${apiBase()}/governance/publications?${query}` : `${apiBase()}/governance/publications`;
  const response = await configuredFetch(url, { headers });
  if (!response.ok) {
    throw new Error('Unable to fetch governance publications');
  }
  return response.json();
}

export async function generateTransparencyReport(input: {
  orgId: string;
  userId: string;
  periodStart?: string;
  periodEnd?: string;
  dryRun?: boolean;
}): Promise<unknown> {
  const payload = {
    orgId: input.orgId,
    periodStart: input.periodStart ?? null,
    periodEnd: input.periodEnd ?? null,
    dryRun: input.dryRun ?? false,
  };

  const response = await configuredFetch(`${apiBase()}/reports/transparency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to generate transparency report (${response.status}): ${body}`);
  }

  return response.json();
}

export async function fetchLaunchDigestsForOrg(input: {
  orgId: string;
  userId: string;
  limit?: number;
}): Promise<LaunchDigestEntry[]> {
  const params = new URLSearchParams({ orgId: input.orgId });
  if (typeof input.limit === 'number') {
    params.set('limit', String(input.limit));
  }

  const response = await configuredFetch(`${apiBase()}/launch/digests?${params.toString()}`, {
    headers: {
      'x-user-id': input.userId,
      'x-org-id': input.orgId,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to fetch launch digests (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { digests?: LaunchDigestEntry[] };
  return json.digests ?? [];
}

export async function fetchDispatchesForOrg(input: {
  orgId: string;
  userId: string;
  periodStart?: string;
  periodEnd?: string;
}): Promise<DispatchRecord[]> {
  const params = new URLSearchParams({ orgId: input.orgId });
  if (input.periodStart) {
    params.set('periodStart', input.periodStart);
  }
  if (input.periodEnd) {
    params.set('periodEnd', input.periodEnd);
  }

  const response = await configuredFetch(`${apiBase()}/reports/dispatches?${params.toString()}`, {
    headers: {
      'x-user-id': input.userId,
      'x-org-id': input.orgId,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to fetch dispatch records (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { dispatches?: DispatchRecord[] };
  return json.dispatches ?? [];
}

const restApiClient = {
  submitResearchQuestion,
  requestHitlReview,
  sendTelemetryEvent,
  fetchCitations,
  fetchHitlQueue,
  fetchHitlMetrics,
  fetchHitlDetail,
  submitHitlAction,
  fetchMatters,
  fetchMatterDetail,
  fetchHitlAuditTrail,
  fetchCorpus,
  resummarizeDocument,
  fetchGovernanceMetrics,
  fetchRetrievalMetrics,
  fetchEvaluationMetrics,
  fetchSloMetrics,
  listSloSnapshots,
  createSloSnapshot,
  fetchSnapshotDiff,
  toggleAllowlistDomain,
  fetchSsoConnections,
  saveSsoConnection,
  removeSsoConnection,
  fetchScimTokens,
  createScimAccessToken,
  deleteScimAccessToken,
  fetchComplianceStatus,
  acknowledgeCompliance,
  fetchAuditEvents,
  fetchDeviceSessions,
  revokeDeviceSession,
  fetchIpAllowlist,
  upsertIpAllowlistEntry,
  deleteIpAllowlistEntry,
  fetchDraftingTemplates,
  fetchWorkspaceOverview,
  getOperationsOverview,
  getGovernancePublications,
  generateTransparencyReport,
  fetchLaunchDigestsForOrg,
  fetchDispatchesForOrg,
} as const;

export type RestApiClient = typeof restApiClient;

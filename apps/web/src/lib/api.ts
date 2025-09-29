import { AgentPlanNotice, AgentPlanStep, IRACPayload } from '@avocat-ai/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3333';

export const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';

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
    } | null;
  };
}

export interface GovernancePublication {
  slug: string;
  title: string;
  summary: string | null;
  doc_url: string | null;
  category: string | null;
  status: string | null;
  published_at?: string | null;
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
  recordedStatus: string;
  recordedEvidenceUrl: string | null;
  recordedNotes: unknown;
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
  compliance: {
    cepej: {
      assessedRuns: number;
      passedRuns: number;
      violationRuns: number;
      friaRequiredRuns: number;
      passRate: number | null;
      violations: Record<string, number>;
    };
    evaluationCoverage: {
      maghrebBanner: number | null;
      rwandaNotice: number | null;
    };
    alerts: Array<{ code: string; level: 'info' | 'warning' | 'critical' }>;
  };
  webVitals: {
    sampleCount: number;
    metrics: {
      LCP: { p75: number | null; unit: 'ms'; sampleCount: number };
      INP: { p75: number | null; unit: 'ms'; sampleCount: number };
      CLS: { p75: number | null; unit: 'score'; sampleCount: number };
    };
    alerts: Array<{ code: string; level: 'info' | 'warning' | 'critical' }>;
  };
}

export async function submitResearchQuestion(input: {
  question: string;
  context?: string;
  orgId: string;
  userId: string;
  confidentialMode?: boolean;
}): Promise<AgentRunResponse> {
  const response = await fetch(`${API_BASE}/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.message ?? 'Agent unavailable');
  }

  return response.json();
}

export async function sendTelemetryEvent(
  eventName: string,
  payload?: Record<string, unknown>,
  orgId: string = DEMO_ORG_ID,
  userId: string = DEMO_USER_ID,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, userId, eventName, payload }),
    });
  } catch (error) {
    console.warn('telemetry_event_failed', eventName, error);
  }
}

export async function fetchCitations(orgId: string) {
  const response = await fetch(`${API_BASE}/citations?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch citations');
  }
  return response.json();
}

export async function fetchHitlQueue(orgId: string) {
  const response = await fetch(`${API_BASE}/hitl?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch HITL queue');
  }
  return response.json();
}

export async function fetchHitlMetrics(orgId: string): Promise<HitlMetricsResponse> {
  const response = await fetch(`${API_BASE}/hitl/metrics?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch HITL metrics');
  }
  return response.json();
}

export async function fetchOperationsOverview(orgId: string): Promise<OperationsOverviewResponse> {
  const response = await fetch(
    `${API_BASE}/admin/org/${encodeURIComponent(orgId)}/operations/overview`,
    {
      headers: { 'x-user-id': DEMO_USER_ID },
    },
  );
  if (!response.ok) {
    throw new Error('Unable to fetch operations overview');
  }
  return response.json();
}

export async function fetchGovernancePublications(orgId?: string): Promise<GovernancePublication[]> {
  const params = new URLSearchParams({ status: 'published' });
  if (orgId) {
    params.set('orgId', orgId);
  }
  const response = await fetch(`${API_BASE}/governance/publications?${params.toString()}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch governance publications');
  }
  const payload = await response.json();
  if (Array.isArray(payload)) {
    return payload as GovernancePublication[];
  }
  if (payload && typeof payload === 'object' && Array.isArray(payload.publications)) {
    return payload.publications as GovernancePublication[];
  }
  return [];
}

export async function submitHitlAction(id: string, action: 'approve' | 'request_changes' | 'reject', comment?: string) {
  const response = await fetch(`${API_BASE}/hitl/${id}`, {
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
  const response = await fetch(`${API_BASE}/matters?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch matters');
  }
  return response.json();
}

export async function fetchMatterDetail(orgId: string, id: string) {
  const response = await fetch(
    `${API_BASE}/matters/${encodeURIComponent(id)}?orgId=${encodeURIComponent(orgId)}`,
  );
  if (!response.ok) {
    throw new Error('Unable to fetch matter');
  }
  return response.json();
}

export async function fetchCorpus(orgId: string) {
  const response = await fetch(`${API_BASE}/corpus?orgId=${encodeURIComponent(orgId)}`, {
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
  const response = await fetch(`${API_BASE}/corpus/${encodeURIComponent(documentId)}/resummarize`, {
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

export async function fetchGovernanceMetrics(orgId: string): Promise<GovernanceMetricsResponse> {
  const response = await fetch(`${API_BASE}/metrics/governance?orgId=${encodeURIComponent(orgId)}`, {
    headers: {
      'x-user-id': DEMO_USER_ID,
    },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch governance metrics');
  }
  const payload = (await response.json()) as GovernanceMetricsResponse;
  return {
    overview: payload.overview ?? null,
    tools: payload.tools ?? [],
    identifiers: payload.identifiers ?? [],
    jurisdictions: payload.jurisdictions ?? [],
  };
}

export async function fetchRetrievalMetrics(orgId: string): Promise<RetrievalMetricsResponse> {
  const response = await fetch(`${API_BASE}/metrics/retrieval?orgId=${encodeURIComponent(orgId)}`, {
    headers: {
      'x-user-id': DEMO_USER_ID,
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
    rwandaNoticeCoverage: number | null;
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
    rwandaNoticeCoverage: number | null;
  }>;
}

export async function fetchEvaluationMetrics(orgId: string): Promise<EvaluationMetricsResponse> {
  const response = await fetch(`${API_BASE}/metrics/evaluations?orgId=${encodeURIComponent(orgId)}`, {
    headers: {
      'x-user-id': DEMO_USER_ID,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to fetch evaluation metrics');
  }

  return response.json();
}

export async function fetchSnapshotDiff(orgId: string, snapshotId: string, compareTo: string) {
  const params = new URLSearchParams({ orgId, snapshotId, compareTo });
  const response = await fetch(`${API_BASE}/corpus/diff?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Unable to compute diff');
  }
  return response.json();
}

export async function toggleAllowlistDomain(host: string, active: boolean, jurisdiction?: string) {
  const response = await fetch(`${API_BASE}/corpus/allowlist/${encodeURIComponent(host)}`, {
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
  const response = await fetch(`${API_BASE}/admin/org/${orgId}/sso`, {
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
  const response = await fetch(`${API_BASE}/admin/org/${orgId}/sso`, {
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
  const response = await fetch(`${API_BASE}/admin/org/${orgId}/sso/${connectionId}`, {
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
  const response = await fetch(`${API_BASE}/admin/org/${orgId}/scim-tokens`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch SCIM tokens');
  }
  return response.json();
}

export async function createScimAccessToken(orgId: string, name: string, expiresAt?: string | null) {
  const response = await fetch(`${API_BASE}/admin/org/${orgId}/scim-tokens`, {
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
  const response = await fetch(`${API_BASE}/admin/org/${orgId}/scim-tokens/${tokenId}`, {
    method: 'DELETE',
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to delete SCIM token');
  }
}

export async function fetchAuditEvents(orgId: string, limit = 50) {
  const response = await fetch(
    `${API_BASE}/admin/org/${orgId}/audit-events?limit=${encodeURIComponent(String(limit))}`,
    { headers: { 'x-user-id': DEMO_USER_ID } },
  );
  if (!response.ok) {
    throw new Error('Unable to fetch audit events');
  }
  return response.json();
}

export async function fetchIpAllowlist(orgId: string) {
  const response = await fetch(`${API_BASE}/admin/org/${orgId}/ip-allowlist`, {
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
    ? `${API_BASE}/admin/org/${orgId}/ip-allowlist/${input.id}`
    : `${API_BASE}/admin/org/${orgId}/ip-allowlist`;
  const method = input.id ? 'PATCH' : 'POST';
  const response = await fetch(url, {
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
  const response = await fetch(`${API_BASE}/admin/org/${orgId}/ip-allowlist/${entryId}`, {
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
  const response = await fetch(`${API_BASE}/drafting/templates?${search.toString()}`);
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
}

export async function fetchWorkspaceOverview(orgId: string): Promise<WorkspaceOverviewResponse> {
  const response = await fetch(`${API_BASE}/workspace?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch workspace overview');
  }
  return response.json();
}

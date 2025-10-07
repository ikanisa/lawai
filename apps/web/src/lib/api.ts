import {
  AgentPlanNotice,
  AgentPlanStep,
  IRACPayload,
  type LaunchOfflineOutboxItem,
  type LaunchReadinessSnapshot,
  type WorkspaceDesk,
  type WorkspaceDeskMode,
  type WorkspaceDeskPlaybook,
  type WorkspaceDeskPlaybookStep,
  type WorkspaceDeskQuickAction,
  type WorkspaceDeskPersona,
  type WorkspaceDeskToolChip,
} from '@avocat-ai/shared';

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3333';

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
  treatmentGraph: Array<{
    caseUrl: string;
    treatment: string;
    decidedAt?: string | null;
    weight?: number | null;
  }>;
  statuteAlignments: Array<{
    caseUrl: string;
    statuteUrl: string;
    article: string | null;
    alignmentScore: number | null;
    rationale?: string | null;
  }>;
  politicalFlags: Array<{
    caseUrl: string;
    flag: string;
    note?: string | null;
  }>;
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

export type TrustPanelComplianceSummary = ComplianceAssessment;

export interface TrustPanelPayload {
  citationSummary: TrustPanelCitationSummary;
  retrievalSummary: TrustPanelRetrievalSummary;
  caseQuality: TrustPanelCaseQualitySummary;
  risk: TrustPanelRiskSummary;
  provenance: TrustPanelProvenanceSummary;
  compliance: TrustPanelComplianceSummary | null;
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
  jurisdictions: Array<{
    jurisdiction: string;
    runCount: number;
    allowlistedRatio: number | null;
    translationWarnings: number;
    snippetCount: number;
    avgWeight: number | null;
    hitlRate: number | null;
    highRiskRate: number | null;
  }>;
  fairness: {
    capturedAt: string | null;
    overallHitlRate: number | null;
    jurisdictions: Array<{
      jurisdiction: string;
      totalRuns: number;
      hitlRate: number | null;
      highRiskShare: number | null;
      benchmarkRate: number | null;
      synonyms?: { terms: number; expansions: number } | null;
      flagged: boolean;
    }>;
    flagged: { jurisdictions: string[]; benchmarks: string[]; synonyms: string[] };
  } | null;
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
  compliance?: ComplianceAssessment | null;
  agent: {
    key: string;
    code: string;
    label: string;
    settings: Record<string, unknown>;
    tools: string[];
  };
}

export interface ComplianceAssessment {
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
      flagged: { jurisdictions: string[]; benchmarks: string[]; synonyms: string[] };
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
    bindingCoverage: number | null;
    residencyCoverage: number | null;
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

export async function processDriveManifest(input: {
  orgId: string;
  userId: string;
  manifestName?: string;
  manifestUrl?: string;
  manifestContent?: string;
  entries?: unknown[];
}) {
  const response = await fetch(`${API_BASE}/gdrive/process-manifest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': input.userId },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'drive_manifest_failed');
  }
  return (await response.json()) as {
    manifestId?: string;
    fileCount?: number;
    validCount?: number;
    warningCount?: number;
    errorCount?: number;
  };
}

export interface GDriveState {
  org_id: string;
  drive_id: string | null;
  folder_id: string | null;
  channel_id: string | null;
  resource_id: string | null;
  expiration: string | null;
  start_page_token: string | null;
  last_page_token: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function fetchGDriveState(orgId: string, userId: string) {
  const response = await fetch(`${API_BASE}/gdrive/state?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': userId },
  });
  if (!response.ok) throw new Error('state_failed');
  return (await response.json()) as { state: GDriveState | null };
}

export async function gdriveInstall(orgId: string, userId: string, driveId?: string | null, folderId?: string | null) {
  const response = await fetch(`${API_BASE}/gdrive/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ orgId, driveId, folderId }),
  });
  if (!response.ok) throw new Error('install_failed');
  return (await response.json()) as { state: GDriveState };
}

export async function gdriveRenew(orgId: string, userId: string) {
  const response = await fetch(`${API_BASE}/gdrive/renew`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ orgId }),
  });
  if (!response.ok) throw new Error('renew_failed');
  return (await response.json()) as { state: GDriveState };
}

export async function gdriveUninstall(orgId: string, userId: string) {
  const response = await fetch(`${API_BASE}/gdrive/uninstall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ orgId }),
  });
  if (!response.ok) throw new Error('uninstall_failed');
  return (await response.json()) as { ok: boolean };
}

export async function gdriveProcessChanges(orgId: string, userId: string, pageToken?: string | null) {
  const response = await fetch(`${API_BASE}/gdrive/process-changes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ orgId, pageToken: pageToken ?? null }),
  });
  if (!response.ok) throw new Error('process_changes_failed');
  return (await response.json()) as { processed: number; next_page_token: string | null };
}

export async function gdriveBackfill(orgId: string, userId: string, batches: number = 5) {
  const response = await fetch(`${API_BASE}/gdrive/backfill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ orgId, batches }),
  });
  if (!response.ok) throw new Error('backfill_failed');
  return (await response.json()) as { processed: number; next_page_token: string | null };
}

export async function uploadDocument(input: {
  orgId: string;
  userId: string;
  file: File;
  bucket?: 'uploads' | 'authorities';
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
}) {
  const arrayBuffer = await input.file.arrayBuffer();
  const base64 = typeof window === 'undefined' ? '' : btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const body = {
    orgId: input.orgId,
    userId: input.userId,
    name: input.file.name,
    mimeType: input.file.type || 'application/octet-stream',
    contentBase64: base64,
    bucket: input.bucket ?? 'uploads',
    source: input.source ?? null,
  };
  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': input.userId },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'upload_failed');
  }
  return (await response.json()) as {
    documentId: string;
    bucket: string;
    storagePath: string;
    bytes: number;
    summaryStatus: string;
    chunkCount: number;
  };
}

export async function startWhatsAppOtp(input: { phone: string; orgId?: string; captchaToken?: string }) {
  const response = await fetch(`${API_BASE}/auth/wa/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone_e164: input.phone,
      org_hint: input.orgId,
      captchaToken: input.captchaToken,
    }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error ?? 'wa_start_failed');
  }
  return (await response.json()) as { sent: boolean; expires_at: string; remaining?: number };
}

export async function verifyWhatsAppOtp(input: {
  phone: string;
  otp: string;
  inviteToken?: string;
  orgHint?: string;
}) {
  const response = await fetch(`${API_BASE}/auth/wa/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone_e164: input.phone,
      otp: input.otp,
      invite_token: input.inviteToken,
      org_hint: input.orgHint,
    }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error ?? 'wa_verify_failed');
  }
  return (await response.json()) as {
    login: boolean;
    user_id: string;
    session_token: string;
    wa_id: string;
    needs_profile: boolean;
    needs_org: boolean;
    is_new_user: boolean;
    memberships: Array<{ org_id: string; role: string }>;
  };
}

export async function linkWhatsAppOtp(input: { phone: string; otp: string; orgId?: string; userId?: string }) {
  const response = await fetch(`${API_BASE}/auth/wa/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId ?? DEMO_USER_ID,
      ...(input.orgId ? { 'x-org-id': input.orgId } : {}),
    },
    body: JSON.stringify({ phone_e164: input.phone, otp: input.otp }),
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error ?? 'wa_link_failed');
  }
  return (await response.json()) as { linked: boolean; wa_id: string };
}

export async function unlinkWhatsApp(input: { orgId?: string; userId?: string }) {
  const response = await fetch(`${API_BASE}/auth/wa/unlink`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId ?? DEMO_USER_ID,
      ...(input.orgId ? { 'x-org-id': input.orgId } : {}),
    },
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody?.error ?? 'wa_unlink_failed');
  }
  return (await response.json()) as { unlinked: boolean };
}

export interface OrgMemberRow {
  user_id: string;
  role: string;
  created_at: string | null;
  profile: {
    full_name?: string | null;
    email?: string | null;
    phone_e164?: string | null;
    locale?: string | null;
    verified?: boolean | null;
  } | null;
}

export async function fetchOrgMembers(orgId: string, userId: string) {
  const response = await fetch(`${API_BASE}/admin/org/members?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': userId },
  });
  if (!response.ok) {
    throw new Error('members_fetch_failed');
  }
  return (await response.json()) as { members: OrgMemberRow[] };
}

export async function createOrgInvite(orgId: string, userId: string, payload: { email: string; role: string; expiresInHours?: number }) {
  const response = await fetch(`${API_BASE}/admin/org/invite`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
    body: JSON.stringify({
      email: payload.email,
      role: payload.role,
      expires_in_hours: payload.expiresInHours,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? 'invite_failed');
  }
  return (await response.json()) as { token: string; expires_at: string };
}

export async function fetchAutonomousUserTypes() {
  const response = await fetch(`${API_BASE}/manifest/autonomous-suite/user-types`);
  if (!response.ok) {
    throw new Error('manifest_user_types_failed');
  }
  return response.json() as Promise<{ userTypes: Array<{ code: string; label: string; default_role: string; features: string[] }> }>;
}

export async function updateMemberRole(orgId: string, actorUserId: string, targetUserId: string, role: string) {
  const response = await fetch(`${API_BASE}/admin/org/members/${encodeURIComponent(targetUserId)}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': actorUserId,
      'x-org-id': orgId,
    },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? 'member_role_failed');
  }
  return (await response.json()) as { updated: boolean };
}

export async function fetchOrgPolicies(orgId: string, userId: string = DEMO_USER_ID) {
  const response = await fetch(`${API_BASE}/admin/org/${encodeURIComponent(orgId)}/policies`, {
    headers: { 'x-user-id': userId },
  });
  if (!response.ok) {
    throw new Error('policies_fetch_failed');
  }
  return (await response.json()) as { policies: Record<string, unknown> };
}

export async function updateOrgPolicies(
  orgId: string,
  userId: string = DEMO_USER_ID,
  updates: Array<{ key: string; value: unknown }>,
  removes: string[] = [],
) {
  const response = await fetch(`${API_BASE}/admin/org/${encodeURIComponent(orgId)}/policies`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({ updates, removes }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? 'policies_update_failed');
  }
  return (await response.json()) as { ok: boolean };
}

export async function fetchJurisdictions(orgId: string, userId: string) {
  const response = await fetch(`${API_BASE}/admin/org/jurisdictions?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': userId },
  });
  if (!response.ok) {
    throw new Error('jurisdictions_fetch_failed');
  }
  return (await response.json()) as { entitlements: Array<{ juris_code: string; can_read: boolean; can_write: boolean }> };
}

export async function updateJurisdictions(orgId: string, userId: string, rows: Array<{ juris_code: string; can_read: boolean; can_write: boolean }>) {
  const response = await fetch(`${API_BASE}/admin/org/jurisdictions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? 'jurisdictions_update_failed');
  }
  return (await response.json()) as { updated: boolean };
}

export async function fetchAuditEvents(orgId: string, userId: string = DEMO_USER_ID, limit = 50) {
  const response = await fetch(
    `${API_BASE}/admin/org/${encodeURIComponent(orgId)}/audit-events?limit=${encodeURIComponent(String(limit))}`,
    {
      headers: { 'x-user-id': userId },
    },
  );
  if (!response.ok) {
    throw new Error('audit_fetch_failed');
  }
  return (await response.json()) as {
    events: Array<{ id: string; kind: string; object: string | null; actor_user_id: string | null; ts: string; before_state: unknown; after_state: unknown }>;
  };
}

export async function recordConsent(orgId: string | undefined, userId: string, type: string, version: string) {
  const response = await fetch(`${API_BASE}/consent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
    },
    body: JSON.stringify({ org_id: orgId, type, version }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? 'consent_failed');
  }
  return (await response.json()) as { recorded: boolean };
}

export async function fetchLearningMetrics(params?: { metric?: string; window?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.metric) query.set('metric', params.metric);
  if (params?.window) query.set('window', params.window);
  if (params?.limit) query.set('limit', String(params.limit));
  const response = await fetch(`${API_BASE}/learning/metrics?${query.toString()}`);
  if (!response.ok) {
    throw new Error('learning_metrics_failed');
  }
  return (await response.json()) as { metrics: Array<{ id: string; window: string; metric: string; value: number; dims: Record<string, unknown>; computed_at: string }> };
}

export async function fetchLearningSignals(orgId: string, userId: string, limit: number = 50) {
  const response = await fetch(`${API_BASE}/learning/signals?orgId=${encodeURIComponent(orgId)}&limit=${limit}`, {
    headers: { 'x-user-id': userId },
  });
  if (!response.ok) {
    throw new Error('learning_signals_failed');
  }
  return (await response.json()) as { signals: Array<{ id: string; run_id?: string | null; source: string; kind: string; payload: Record<string, unknown>; created_at: string }> };
}

export async function submitLearningFeedback(orgId: string, userId: string, payload: { runId: string; rating: 'up' | 'down'; reasonCode?: string; freeText?: string }) {
  const response = await fetch(`${API_BASE}/learning/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': userId,
      'x-org-id': orgId,
    },
    body: JSON.stringify({
      run_id: payload.runId,
      rating: payload.rating,
      reason_code: payload.reasonCode,
      free_text: payload.freeText,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error ?? 'feedback_failed');
  }
  return (await response.json()) as { recorded: boolean };
}

export async function submitResearchQuestion(input: {
  question: string;
  context?: string;
  orgId: string;
  userId: string;
  confidentialMode?: boolean;
  agentCode?: string;
  agentSettings?: Record<string, unknown> | null;
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

export async function fetchCaseScore(orgId: string, sourceId: string) {
  const response = await fetch(
    `${API_BASE}/case-scores?orgId=${encodeURIComponent(orgId)}&sourceId=${encodeURIComponent(sourceId)}`,
    { headers: { 'x-user-id': DEMO_USER_ID } },
  );
  if (!response.ok) throw new Error('Unable to fetch case score');
  const payload = await response.json();
  const score = Array.isArray(payload?.scores) && payload.scores.length > 0 ? payload.scores[0] : null;
  return score as
    | {
        id: string;
        sourceId: string;
        jurisdiction: string;
        score: number;
        axes: Record<string, number>;
        hardBlock: boolean;
        notes: unknown;
        computedAt: string;
      }
    | null;
}

export async function fetchCaseTreatments(orgId: string, sourceId: string) {
  const response = await fetch(
    `${API_BASE}/case-treatments?orgId=${encodeURIComponent(orgId)}&sourceId=${encodeURIComponent(sourceId)}`,
    { headers: { 'x-user-id': DEMO_USER_ID } },
  );
  if (!response.ok) throw new Error('Unable to fetch treatments');
  return (await response.json()) as { treatments: Array<{ treatment: string; decidedAt?: string | null }> };
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

export async function fetchAlerts(orgId: string) {
  const response = await fetch(`${API_BASE}/metrics/alerts?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) throw new Error('Unable to fetch alerts');
  return response.json() as Promise<{
    thresholds: { precision: number; temporal: number; linkHealthFailureRatioMax: number };
    results: {
      citationPrecision: { ok: boolean; value: number | null };
      temporalValidity: { ok: boolean; value: number | null };
      linkHealth: { ok: boolean; failed: number; totalSources: number };
    };
  }>;
}

export async function fetchExports(orgId: string) {
  const response = await fetch(`${API_BASE}/admin/org/${encodeURIComponent(orgId)}/exports`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) throw new Error('Unable to fetch exports');
  return (await response.json()) as {
    exports: Array<{
      id: string;
      format: string;
      status: string;
      file_path?: string | null;
      signedUrl?: string | null;
      error?: string | null;
      created_at: string;
      completed_at?: string | null;
      signature_manifest?: Record<string, unknown> | null;
      content_sha256?: string | null;
    }>;
  };
}

export async function requestExport(orgId: string, format: 'csv' | 'json' = 'csv') {
  const response = await fetch(`${API_BASE}/admin/org/${encodeURIComponent(orgId)}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
    body: JSON.stringify({ format }),
  });
  if (!response.ok) throw new Error('Unable to request export');
  return (await response.json()) as { id: string; status: string; filePath?: string | null };
}

export async function fetchDeletionRequests(orgId: string) {
  const response = await fetch(`${API_BASE}/admin/org/${encodeURIComponent(orgId)}/deletion-requests`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) throw new Error('Unable to fetch deletion requests');
  return (await response.json()) as { requests: Array<{ id: string; target: string; target_id?: string | null; reason?: string | null; status: string; created_at: string; processed_at?: string | null; error?: string | null }> };
}

export async function createDeletionRequest(orgId: string, target: 'document' | 'source' | 'org', id?: string, reason?: string) {
  const response = await fetch(`${API_BASE}/admin/org/${encodeURIComponent(orgId)}/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
    body: JSON.stringify({ target, id, reason }),
  });
  if (!response.ok) throw new Error('Unable to create deletion request');
  return (await response.json()) as { id: string; status: string };
}

export interface LaunchCollateral {
  pilotOnboarding: Array<{ title: string; summary: string; url: string }>;
  pricingPacks: Array<{ name: string; tiers: string[]; url: string }>;
  transparency: Array<{ label: string; jurisdiction: string; url: string }>;
}

export async function fetchLaunchCollateral(): Promise<LaunchCollateral> {
  const response = await fetch(`${API_BASE}/launch/collateral`);
  if (!response.ok) throw new Error('Unable to fetch launch collateral');
  return (await response.json()) as LaunchCollateral;
}

export interface RegulatorDigestEntry {
  id: string;
  jurisdiction: string;
  channel: 'email' | 'slack' | 'teams';
  frequency: 'weekly' | 'monthly';
  recipients: string[];
  topics?: string[];
  createdAt: string;
  sloSummary: Record<string, unknown>;
}

export async function fetchRegulatorDigests() {
  const response = await fetch(`${API_BASE}/launch/digests`);
  if (!response.ok) throw new Error('Unable to fetch regulator digests');
  return (await response.json()) as { digests: RegulatorDigestEntry[] };
}

export async function fetchLaunchReadiness(orgId: string): Promise<LaunchReadinessSnapshot> {
  const response = await fetch(`${API_BASE}/launch/readiness?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) throw new Error('Unable to fetch launch readiness');
  return (await response.json()) as LaunchReadinessSnapshot;
}

export async function fetchOfflineOutbox(orgId: string): Promise<{ items: LaunchOfflineOutboxItem[] }> {
  const response = await fetch(`${API_BASE}/launch/offline-outbox?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) throw new Error('Unable to fetch offline outbox');
  return (await response.json()) as { items: LaunchOfflineOutboxItem[] };
}

export interface CreateOfflineOutboxInput {
  orgId: string;
  channel: LaunchOfflineOutboxItem['channel'];
  label: string;
  locale?: string | null;
}

export async function createOfflineOutboxItem(input: CreateOfflineOutboxInput) {
  const response = await fetch(`${API_BASE}/launch/offline-outbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
    body: JSON.stringify({
      orgId: input.orgId,
      channel: input.channel,
      label: input.label,
      locale: input.locale,
    }),
  });
  if (!response.ok) throw new Error('Unable to create offline outbox item');
  return (await response.json()) as { item: LaunchOfflineOutboxItem };
}

export async function updateOfflineOutboxItem(
  itemId: string,
  input: { orgId: string; status: LaunchOfflineOutboxItem['status']; lastAttemptAt?: string },
) {
  const response = await fetch(`${API_BASE}/launch/offline-outbox/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
    body: JSON.stringify({
      orgId: input.orgId,
      status: input.status,
      lastAttemptAt: input.lastAttemptAt,
    }),
  });
  if (!response.ok) throw new Error('Unable to update offline outbox item');
  return (await response.json()) as { item: LaunchOfflineOutboxItem };
}

export interface SloSnapshotInput {
  captured_at: string;
  api_uptime_percent?: number;
  hitl_response_p95_seconds?: number;
  retrieval_latency_p95_seconds?: number;
  citation_precision_p95?: number | null;
  notes?: string | null;
}

export interface CreateRegulatorDigestInput {
  jurisdiction: string;
  channel: 'email' | 'slack' | 'teams';
  frequency: 'weekly' | 'monthly';
  recipients: string[];
  topics?: string[];
  sloSnapshots?: SloSnapshotInput[];
}

export async function createRegulatorDigest(input: CreateRegulatorDigestInput) {
  const response = await fetch(`${API_BASE}/launch/digests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error('Unable to create regulator digest');
  }
  return (await response.json()) as { digest: RegulatorDigestEntry };
}

export interface WebVitalMetric {
  id: string;
  name: string;
  value: number;
  delta: number;
  label: string;
  rating: 'good' | 'needs-improvement' | 'poor';
  page: string;
  locale?: string | null;
  navigationType?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export async function fetchWebVitals(orgId: string, limit = 20) {
  const response = await fetch(`${API_BASE}/metrics/web-vitals?limit=${encodeURIComponent(String(limit))}`, {
    headers: { 'x-user-id': DEMO_USER_ID, 'x-org-id': orgId },
  });
  if (!response.ok) throw new Error('Unable to fetch web vitals');
  return (await response.json()) as { metrics: WebVitalMetric[] };
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

export interface MatterCalendarSettings {
  type: 'calendar' | 'court';
  timezone: string;
  method: 'standard' | 'expedited' | 'extended';
}

export interface MatterCiteCheckSummary {
  total: number;
  verified: number;
  pending: number;
  manual: number;
}

export interface MatterSummary {
  id: string;
  title: string;
  status: string | null;
  riskLevel: string | null;
  hitlRequired: boolean;
  jurisdiction: string | null;
  procedure: string | null;
  residencyZone: string | null;
  filingDate: string | null;
  decisionDate: string | null;
  createdAt: string;
  updatedAt: string;
  calendarSettings: MatterCalendarSettings;
  citeCheck: MatterCiteCheckSummary;
  nextDeadline: { name: string; dueAt: string; ruleReference: string | null } | null;
}

export interface MatterDeadline {
  id: string;
  name: string;
  dueAt: string | null;
  ruleReference: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
}

export interface MatterDocument {
  id: string;
  documentId: string | null;
  name: string | null;
  storagePath: string | null;
  bucket: string | null;
  mimeType: string | null;
  bytes: number | null;
  residencyZone: string | null;
  role: string | null;
  citeCheckStatus: string | null;
  metadata: Record<string, unknown>;
}

export interface MatterDetailResponse {
  matter: {
    id: string;
    title: string;
    description: string | null;
    question?: string | null;
    status: string;
    riskLevel: string | null;
    hitlRequired: boolean;
    jurisdiction: string | null;
    procedure: string | null;
    residencyZone: string | null;
    filingDate: string | null;
    decisionDate: string | null;
    createdAt: string;
    updatedAt: string;
    metadata: Record<string, unknown>;
    structuredPayload: unknown;
    agentRunId: string | null;
    primaryDocumentId: string | null;
    provenance?: {
      residency?: Array<{ zone: string; count: number }>;
    };
    citations?: Array<{
      title?: string | null;
      publisher?: string | null;
      url: string;
    }>;
  };
  deadlines: MatterDeadline[];
  documents: MatterDocument[];
  calendar: string;
  calendarUrl: string | null;
  calendarSettings: MatterCalendarSettings;
  citeCheck: MatterCiteCheckSummary;
}

export interface MatterListResponse {
  matters: MatterSummary[];
}

export async function fetchMatters(orgId: string): Promise<MatterListResponse> {
  const response = await fetch(`${API_BASE}/matters?orgId=${encodeURIComponent(orgId)}`, {
    headers: { 'x-user-id': DEMO_USER_ID },
  });
  if (!response.ok) {
    throw new Error('Unable to fetch matters');
  }
  return (await response.json()) as MatterListResponse;
}

export async function fetchMatterDetail(orgId: string, id: string): Promise<MatterDetailResponse> {
  const response = await fetch(
    `${API_BASE}/matters/${encodeURIComponent(id)}?orgId=${encodeURIComponent(orgId)}`,
    {
      headers: { 'x-user-id': DEMO_USER_ID },
    },
  );
  if (!response.ok) {
    throw new Error('Unable to fetch matter');
  }
  return (await response.json()) as MatterDetailResponse;
}

export interface MatterUpsertPayload {
  orgId: string;
  userId?: string;
  title?: string;
  description?: string | null;
  jurisdiction?: string | null;
  procedure?: string | null;
  status?: string | null;
  riskLevel?: string | null;
  hitlRequired?: boolean;
  filingDate?: string | null;
  decisionDate?: string | null;
  agentRunId?: string | null;
  draftId?: string | null;
  primaryDocumentId?: string | null;
  structuredPayload?: unknown;
  metadata?: Record<string, unknown>;
  calendarType?: 'calendar' | 'court';
  calendarTimezone?: string;
  calendarMethod?: 'standard' | 'expedited' | 'extended';
  deadlines?: Array<{
    id?: string;
    name: string;
    dueAt: string;
    ruleReference?: string | null;
    notes?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  documents?: Array<{
    documentId: string;
    role?: string | null;
    citeCheckStatus?: string | null;
    metadata?: Record<string, unknown>;
  }>;
}

export async function previewMatterDeadlines(payload: {
  orgId: string;
  jurisdiction?: string;
  procedure?: string;
  filingDate?: string;
  calendarType?: 'calendar' | 'court';
  calendarTimezone?: string;
  calendarMethod?: 'standard' | 'expedited' | 'extended';
}): Promise<{
  calendarSettings: MatterCalendarSettings;
  deadlines: Array<{ name: string; dueAt: string; ruleReference: string; notes: string }>;
  notes: { method: string; calendar: string };
}> {
  const response = await fetch(`${API_BASE}/matters/deadlines/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': DEMO_USER_ID },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error('Unable to preview deadlines');
  }
  return (await response.json()) as {
    calendarSettings: MatterCalendarSettings;
    deadlines: Array<{ name: string; dueAt: string; ruleReference: string; notes: string }>;
    notes: { method: string; calendar: string };
  };
}

export async function createMatter(payload: MatterUpsertPayload): Promise<MatterDetailResponse> {
  const userId = payload.userId ?? DEMO_USER_ID;
  const response = await fetch(`${API_BASE}/matters`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ ...payload, userId }),
  });
  if (!response.ok) {
    throw new Error('Unable to create matter');
  }
  return (await response.json()) as MatterDetailResponse;
}

export async function updateMatter(id: string, payload: MatterUpsertPayload): Promise<MatterDetailResponse> {
  const userId = payload.userId ?? DEMO_USER_ID;
  const response = await fetch(`${API_BASE}/matters/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify({ ...payload, userId }),
  });
  if (!response.ok) {
    throw new Error('Unable to update matter');
  }
  return (await response.json()) as MatterDetailResponse;
}

export async function deleteMatter(orgId: string, id: string, userId?: string): Promise<void> {
  const params = new URLSearchParams({ orgId });
  if (userId) {
    params.set('userId', userId);
  }
  const response = await fetch(
    `${API_BASE}/matters/${encodeURIComponent(id)}?${params.toString()}`,
    {
      method: 'DELETE',
      headers: { 'x-user-id': userId ?? DEMO_USER_ID },
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error('Unable to delete matter');
  }
}

export interface MatterCalendarExport {
  calendar: string;
  calendarUrl: string | null;
  calendarSettings: MatterCalendarSettings;
}

export async function fetchMatterCalendar(orgId: string, id: string): Promise<MatterCalendarExport> {
  const response = await fetch(
    `${API_BASE}/matters/${encodeURIComponent(id)}/calendar?orgId=${encodeURIComponent(orgId)}`,
    {
      headers: { 'x-user-id': DEMO_USER_ID },
    },
  );

  if (!response.ok) {
    throw new Error('Unable to fetch matter calendar');
  }

  return (await response.json()) as MatterCalendarExport;
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

export async function fetchDraftingTemplates(
  orgId: string,
  params?: { jurisdiction?: string; matterType?: string },
  userId: string = DEMO_USER_ID,
) {
  const search = new URLSearchParams({ orgId });
  if (params?.jurisdiction) {
    search.set('jurisdiction', params.jurisdiction);
  }
  if (params?.matterType) {
    search.set('matterType', params.matterType);
  }
  const response = await fetch(`${API_BASE}/drafting/templates?${search.toString()}`, {
    headers: {
      'x-user-id': userId,
      'x-org-id': orgId,
    },
  });
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
    agentCode: string | null;
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
  desk?: WorkspaceDesk | null;
}

export async function fetchWorkspaceOverview(orgId: string): Promise<WorkspaceOverviewResponse> {
  const response = await fetch(`${API_BASE}/workspace?orgId=${encodeURIComponent(orgId)}`);
  if (!response.ok) {
    throw new Error('Unable to fetch workspace overview');
  }
  return response.json();
}

export interface DraftCitation {
  title: string;
  url: string;
  publisher?: string | null;
  jurisdiction?: string | null;
  binding: boolean;
  residencyZone?: string | null;
  note?: string | null;
}

export interface DraftClauseDiffChange {
  type: 'added' | 'removed' | 'context';
  text: string;
}

export interface DraftClauseDiff {
  summary: { additions: number; deletions: number; net: number };
  changes: DraftClauseDiffChange[];
  recommendation: string;
}

export interface DraftClauseComparison {
  clauseId: string;
  title: string;
  rationale: string;
  baseline: string;
  proposed: string;
  diff: DraftClauseDiff;
  riskLevel: 'low' | 'medium' | 'high';
  citations: DraftCitation[];
}

export interface DraftExportMeta {
  format: string;
  status: 'ready' | 'pending' | 'failed';
  bucket?: string | null;
  storagePath?: string | null;
  bytes?: number | null;
  sha256?: string | null;
  c2pa?: {
    keyId: string;
    signedAt: string;
    algorithm: string;
    statementId: string;
  };
}

export interface DraftSignature {
  keyId: string;
  signedAt: string;
  algorithm: string;
  statementId: string;
  manifest: Record<string, unknown>;
}

export interface DraftGenerationResponse {
  draftId: string;
  documentId: string;
  title: string;
  jurisdiction: string | null;
  matterType: string | null;
  bucket: string;
  storagePath: string;
  bytes: number;
  preview: string;
  citations: DraftCitation[];
  clauseComparisons: DraftClauseComparison[];
  exports: DraftExportMeta[];
  signature: DraftSignature;
  contentSha256: string;
  fillIns: string[];
  agentRunId: string;
  structuredPayload: IRACPayload;
  risk: IRACPayload['risk'];
  verification: VerificationResult | null;
  trustPanel?: TrustPanelPayload | null;
  plan?: AgentPlanStep[];
  reused?: boolean;
}

export async function createDraft(input: {
  orgId: string;
  userId: string;
  prompt: string;
  title?: string;
  jurisdiction?: string;
  matterType?: string;
  templateId?: string;
  fillIns?: string[];
  context?: string;
}): Promise<DraftGenerationResponse> {
  const response = await fetch(`${API_BASE}/drafts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-id': input.userId,
      'x-org-id': input.orgId,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'draft_create_failed');
  }
  return (await response.json()) as DraftGenerationResponse;
}

export async function fetchDraftPreview(orgId: string, documentId: string) {
  const params = new URLSearchParams({ orgId, documentId });
  const response = await fetch(`${API_BASE}/drafts/preview?${params.toString()}`, {
    headers: { 'x-user-id': DEMO_USER_ID, 'x-org-id': orgId },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'draft_preview_failed');
  }
  return (await response.json()) as {
    documentId: string;
    draftId: string | null;
    title: string | null;
    jurisdiction: string | null;
    matterType: string | null;
    content: string;
    mimeType: string;
    bytes: number;
    createdAt: string | null;
    summaryStatus: string | null;
    chunkCount: number;
    citations: DraftCitation[];
    clauseComparisons: DraftClauseComparison[];
    exports: DraftExportMeta[];
    signature: DraftSignature | null;
    contentSha256: string | null;
    status: string | null;
    fillIns: string[];
    structuredPayload: IRACPayload | null;
    plan: AgentPlanStep[];
    trustPanel: TrustPanelPayload | null;
    verification: VerificationResult | null;
  };
}

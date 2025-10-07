import {
  Agent,
  OpenAIProvider,
  defineOutputGuardrail,
  fileSearchTool,
  run as runAgent,
  setDefaultModelProvider,
  setDefaultOpenAIKey,
  setOpenAIAPI,
  tool,
  webSearchTool,
} from '@openai/agents';
import {
  AgentPlanNotice,
  AgentPlanStep,
  IRACPayload,
  IRACSchema,
  OFFICIAL_DOMAIN_ALLOWLIST,
  getAgentDefinition,
  getAutonomousSuiteManifest,
} from '@avocat-ai/shared';
import type { AutonomousAgentCode, AutonomousJusticeSuiteManifest } from '@avocat-ai/shared';
import { diffWordsWithSpace } from 'diff';
import { createServiceClient } from '@avocat-ai/supabase';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';
import { env, loadAllowlistOverride } from './config.js';
import {
  CASE_TRUST_WEIGHTS,
  evaluateCaseQuality,
  type CaseScoreAxis,
  type CaseTreatmentGraphNode,
  type CaseRiskFlag,
  type CaseStatuteSnippet,
  type TreatmentSignal,
} from './case-quality.js';
import { OrgAccessContext, isJurisdictionAllowed } from './access-control.js';
import { evaluateCompliance } from './compliance.js';
import type { ComplianceAssessment } from './compliance.js';

type ToolInvocationLog = {
  name: string;
  args: unknown;
  output: unknown;
};

type ToolTelemetry = {
  name: string;
  latencyMs: number;
  success: boolean;
  errorCode?: string | null;
};

type ComplianceEventRecord = {
  kind: string;
  metadata?: Record<string, unknown>;
};

type VerificationSeverity = 'info' | 'warning' | 'critical';

export type VerificationStatus = 'passed' | 'hitl_escalated';

export interface VerificationNote {
  code: string;
  message: string;
  severity: VerificationSeverity;
}

export interface VerificationResult {
  status: VerificationStatus;
  notes: VerificationNote[];
  allowlistViolations: string[];
}

export interface AgentRunInput {
  question: string;
  context?: string;
  orgId: string;
  userId: string;
  confidentialMode?: boolean;
  agentCode?: string | null;
  agentSettings?: Record<string, unknown> | null;
}

export interface AgentRunResult {
  runId: string;
  payload: IRACPayload;
  allowlistViolations: string[];
  toolLogs: ToolInvocationLog[];
  plan?: AgentPlanStep[];
  reused?: boolean;
  notices?: AgentPlanNotice[];
  verification?: VerificationResult;
  trustPanel?: TrustPanelPayload;
  compliance?: ComplianceAssessment | null;
  agent: {
    key: AutonomousAgentCode;
    code: string;
    label: string;
    settings: Record<string, unknown>;
    tools: string[];
  };
}

interface JurisdictionHint {
  country: string;
  eu: boolean;
  ohada: boolean;
  confidence: number;
  rationale: string;
}

interface RoutingResult {
  primary: JurisdictionHint | null;
  candidates: JurisdictionHint[];
  warnings: string[];
}

interface AgentExecutionContext {
  orgId: string;
  userId: string;
  allowlist: string[];
  prompt: string;
  supplementalContext?: string;
  initialRouting: RoutingResult;
  lastJurisdiction: JurisdictionHint | null;
  confidentialMode: boolean;
  allowedJurisdictions: string[];
  residencyZone: string | null;
  sensitiveTopicHitl: boolean;
  toolUsage: Record<string, number>;
  toolBudgets: Record<string, number>;
  synonymExpansions: Record<string, string[]>;
  policyVersion: PolicyVersionContext | null;
  agentKey: AutonomousAgentCode;
  agentCode: string;
  agentLabel: string;
  agentSettings: Record<string, unknown>;
  allowedTools: string[];
}

interface PolicyVersionContext {
  name: string;
  activatedAt: string;
  notes?: string | null;
}

interface FranceAnalyticsGuardResult {
  triggered: boolean;
  rationale: string;
}

interface CaseQualitySummary {
  sourceId: string;
  url: string;
  score: number;
  hardBlock: boolean;
  notes: string[];
  axes: Record<CaseScoreAxis, number>;
  treatments: TreatmentSignal[];
  statuteAlignments: CaseStatuteSnippet[];
  riskSignals: Array<{ flag: string; note?: string | null }>;
}

const CASE_AXES: CaseScoreAxis[] = ['PW', 'ST', 'SA', 'PI', 'JF', 'LB', 'RC', 'CQ'];

interface TrustPanelCitationSummary {
  total: number;
  allowlisted: number;
  ratio: number;
  nonAllowlisted: Array<{ title: string; url: string }>;
  translationWarnings: string[];
  bindingNotes: Record<string, number>;
  rules: { total: number; binding: number; nonBinding: number };
}

interface TrustPanelCaseItem {
  url: string;
  score: number;
  hardBlock: boolean;
  notes: string[];
  axes: Record<CaseScoreAxis, number>;
}

interface TrustPanelCaseQualitySummary {
  items: TrustPanelCaseItem[];
  minScore: number | null;
  maxScore: number | null;
  forceHitl: boolean;
  treatmentGraph: CaseTreatmentGraphNode[];
  statuteAlignments: CaseStatuteSnippet[];
  politicalFlags: CaseRiskFlag[];
}

interface TrustPanelRetrievalSummary {
  snippetCount: number;
  fileSearch: number;
  local: number;
  topHosts: Array<{ host: string; count: number }>;
}

interface TrustPanelRiskSummary {
  level: IRACPayload['risk']['level'];
  hitlRequired: boolean;
  reason: string;
  verification: {
    status: VerificationStatus;
    notes: VerificationNote[];
  };
}

interface TrustPanelProvenanceSummary {
  totalSources: number;
  withEli: number;
  withEcli: number;
  residencyBreakdown: Array<{ zone: string; count: number }>;
  bindingLanguages: Array<{ language: string; count: number }>;
  akomaArticles: number;
}

interface StatuteAlignmentDetail {
  caseUrl: string;
  statuteUrl: string;
  article: string | null;
  alignmentScore: number | null;
}

interface ComplianceContext {
  requiredConsentVersion?: string | null;
  acknowledgedConsentVersion?: string | null;
  requiredCoeVersion?: string | null;
  acknowledgedCoeVersion?: string | null;
}

type TrustPanelComplianceSummary = ComplianceAssessment & {
  disclosures: ComplianceAssessment['disclosures'];
};

export interface TrustPanelPayload {
  citationSummary: TrustPanelCitationSummary;
  retrievalSummary: TrustPanelRetrievalSummary;
  caseQuality: TrustPanelCaseQualitySummary;
  risk: TrustPanelRiskSummary;
  provenance: TrustPanelProvenanceSummary;
  compliance: TrustPanelComplianceSummary | null;
}

export interface HybridSnippet {
  content: string;
  similarity: number;
  weight: number;
  origin: 'local' | 'file_search';
  sourceId?: string | null;
  documentId?: string | null;
  fileId?: string | null;
  url?: string | null;
  title?: string | null;
  publisher?: string | null;
  trustTier?: 'T1' | 'T2' | 'T3' | 'T4';
  eli?: string | null;
  ecli?: string | null;
  bindingLanguage?: string | null;
  residencyZone?: string | null;
  akomaArticleCount?: number | null;
}

const supabase = createServiceClient({
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
});

const toStringArray = (input: unknown): string[] =>
  Array.isArray(input) ? input.filter((value): value is string => typeof value === 'string') : [];

async function fetchComplianceAssessmentForRun(
  runId: string,
  context: 'existing_run' | 'trust_panel',
): Promise<ComplianceAssessment | null> {
  const complianceQuery = await supabase
    .from('compliance_assessments')
    .select(
      'fria_required, fria_reasons, cepej_passed, cepej_violations, statute_passed, statute_violations, disclosures_missing',
    )
    .eq('run_id', runId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (complianceQuery.error) {
    console.warn(`${context}_compliance_lookup_failed`, complianceQuery.error.message);
    return null;
  }

  const row = complianceQuery.data as
    | {
        fria_required?: boolean | null;
        fria_reasons?: unknown;
        cepej_passed?: boolean | null;
        cepej_violations?: unknown;
        statute_passed?: boolean | null;
        statute_violations?: unknown;
        disclosures_missing?: unknown;
      }
    | null;

  if (!row) {
    return null;
  }

  const missing = toStringArray(row.disclosures_missing);

  return {
    fria: {
      required: Boolean(row.fria_required),
      reasons: toStringArray(row.fria_reasons),
    },
    cepej: {
      passed: row.cepej_passed ?? true,
      violations: toStringArray(row.cepej_violations),
    },
    statute: {
      passed: row.statute_passed ?? true,
      violations: toStringArray(row.statute_violations),
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
  } satisfies ComplianceAssessment;
}

const DOMAIN_ALLOWLIST = loadAllowlistOverride() ?? [...OFFICIAL_DOMAIN_ALLOWLIST];

const stubMode = env.AGENT_STUB_MODE;

const TOOL_BUDGET_DEFAULTS: Record<string, number> = {
  web_search: 3,
  file_search: 8,
  route_jurisdiction: 3,
  lookup_code_article: 5,
  deadline_calculator: 3,
  ohada_uniform_act: 3,
  limitation_check: 3,
  interest_calculator: 3,
  check_binding_language: 5,
  validate_citation: 5,
  redline_contract: 2,
  snapshot_authority: 2,
  generate_pleading_template: 2,
  evaluate_case_alignment: 3,
  compute_case_score: 3,
  build_treatment_graph: 1,
  court_fees: 2,
  service_of_process: 2,
  hearing_schedule: 1,
  exhibit_bundler: 1,
  document_parser: 1,
  risk_assessor: 2,
};

const DEFAULT_TOOL_BUDGET = 3;

type AgentManifestEntry = AutonomousJusticeSuiteManifest['agents'][AutonomousAgentCode];

interface SelectedAgentProfile {
  key: AutonomousAgentCode;
  manifestCode: string;
  label: string;
  mission: string | null;
  declaredTools: string[];
  allowedToolKeys: string[];
  settings: Record<string, unknown>;
  allowOverrideApplied: boolean;
}

const DEFAULT_AGENT_KEY: AutonomousAgentCode = 'counsel_research';

const SUITE_MANIFEST = getAutonomousSuiteManifest();

function normaliseAgentSettings(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!input || typeof input !== 'object') {
    return {};
  }
  if (Array.isArray(input)) {
    return {};
  }
  return { ...input };
}

function resolveAgentKey(code: string | null | undefined): AutonomousAgentCode {
  if (typeof code !== 'string' || code.trim().length === 0) {
    return DEFAULT_AGENT_KEY;
  }
  const target = code.trim().toLowerCase();
  const entries = Object.entries(SUITE_MANIFEST.agents) as Array<[
    AutonomousAgentCode,
    AgentManifestEntry,
  ]>;
  for (const [key, definition] of entries) {
    if (key.toLowerCase() === target) {
      return key;
    }
    const manifestCode = typeof definition.code === 'string' ? definition.code.trim().toLowerCase() : null;
    if (manifestCode && manifestCode === target) {
      return key;
    }
  }
  return DEFAULT_AGENT_KEY;
}

const TOOL_CODE_OVERRIDES: Record<string, string> = {
  generate_template: 'generate_pleading_template',
  pleading_template: 'generate_pleading_template',
  case_alignment: 'evaluate_case_alignment',
};

function normaliseManifestToolCode(code: string | null | undefined): string | null {
  if (typeof code !== 'string') {
    return null;
  }
  const trimmed = code.trim();
  if (!trimmed) {
    return null;
  }
  const withoutSuffix = trimmed.replace(/\?$/, '');
  const snake = withoutSuffix
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
  if (TOOL_CODE_OVERRIDES[snake]) {
    return TOOL_CODE_OVERRIDES[snake];
  }
  if (TOOL_CODE_OVERRIDES[withoutSuffix]) {
    return TOOL_CODE_OVERRIDES[withoutSuffix];
  }
  return snake || null;
}

function deriveAllowedToolKeys(
  definition: AgentManifestEntry,
  settings: Record<string, unknown>,
): { manifestTools: string[]; allowedKeys: string[]; overrideApplied: boolean } {
  const declaredTools = Array.isArray(definition.tools)
    ? definition.tools.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const manifestToolKeys = declaredTools
    .map((tool) => normaliseManifestToolCode(tool))
    .filter((tool): tool is string => Boolean(tool));

  const defaults = manifestToolKeys.length > 0 ? manifestToolKeys : Object.keys(TOOL_BUDGET_DEFAULTS);
  const baseSet = new Set(defaults);
  baseSet.add('route_jurisdiction');
  baseSet.add('validate_citation');

  let overrideApplied = false;
  const allowTools = settings.allow_tools;
  if (Array.isArray(allowTools)) {
    const overrideKeys = allowTools
      .map((entry) => (typeof entry === 'string' ? normaliseManifestToolCode(entry) : null))
      .filter((entry): entry is string => Boolean(entry));
    if (overrideKeys.length > 0) {
      overrideApplied = true;
      const allowedOverride = new Set(overrideKeys);
      for (const key of Array.from(baseSet)) {
        if (!allowedOverride.has(key)) {
          baseSet.delete(key);
        }
      }
    }
  }

  if (baseSet.size === 0) {
    for (const key of Object.keys(TOOL_BUDGET_DEFAULTS)) {
      baseSet.add(key);
    }
    baseSet.add('route_jurisdiction');
    baseSet.add('validate_citation');
  }

  return {
    manifestTools: declaredTools,
    allowedKeys: Array.from(baseSet),
    overrideApplied,
  };
}

function deriveToolBudgets(allowedKeys: string[]): Record<string, number> {
  if (!Array.isArray(allowedKeys) || allowedKeys.length === 0) {
    return { ...TOOL_BUDGET_DEFAULTS };
  }
  const allowedSet = new Set(allowedKeys);
  const budgets: Record<string, number> = {};
  for (const [tool, budget] of Object.entries(TOOL_BUDGET_DEFAULTS)) {
    budgets[tool] = allowedSet.has(tool) ? budget : 0;
  }
  for (const tool of allowedSet) {
    if (!(tool in budgets)) {
      budgets[tool] = DEFAULT_TOOL_BUDGET;
    }
  }
  return budgets;
}

function createEmptyProvenance(): IRACPayload['provenance'] {
  return {
    eli: [],
    ecli: [],
    akoma_articles: 0,
    feeds: [],
    statute_alignments: [],
    disclosures: {
      consent: { required: null, acknowledged: null },
      council_of_europe: { required: null, acknowledged: null },
      satisfied: false,
    },
    quarantine: { flagged: false, reason: null },
  };
}

function ensureProvenance(payload: IRACPayload): IRACPayload['provenance'] {
  if (!payload.provenance) {
    payload.provenance = createEmptyProvenance();
    return payload.provenance;
  }
  const provenance = payload.provenance;
  provenance.eli = Array.isArray(provenance.eli) ? provenance.eli : [];
  provenance.ecli = Array.isArray(provenance.ecli) ? provenance.ecli : [];
  provenance.akoma_articles = Number.isFinite(provenance.akoma_articles)
    ? provenance.akoma_articles
    : 0;
  provenance.feeds = Array.isArray(provenance.feeds) ? provenance.feeds : [];
  provenance.statute_alignments = Array.isArray(provenance.statute_alignments)
    ? provenance.statute_alignments
    : [];
  provenance.disclosures = provenance.disclosures ?? {
    consent: { required: null, acknowledged: null },
    council_of_europe: { required: null, acknowledged: null },
    satisfied: false,
  };
  provenance.disclosures.consent = provenance.disclosures.consent ?? {
    required: null,
    acknowledged: null,
  };
  provenance.disclosures.council_of_europe = provenance.disclosures.council_of_europe ?? {
    required: null,
    acknowledged: null,
  };
  if (typeof provenance.disclosures.satisfied !== 'boolean') {
    provenance.disclosures.satisfied = false;
  }
  provenance.quarantine = provenance.quarantine ?? { flagged: false, reason: null };
  if (typeof provenance.quarantine.flagged !== 'boolean') {
    provenance.quarantine.flagged = false;
  }
  provenance.quarantine.reason = provenance.quarantine.reason ?? null;
  return provenance;
}

function applyDisclosureProvenance(
  payload: IRACPayload,
  accessContext: OrgAccessContext | null | undefined,
): void {
  const provenance = ensureProvenance(payload);
  const requiredConsent = accessContext?.consent.requiredVersion ?? null;
  const acknowledgedConsent = accessContext?.consent.latestAcceptedVersion ?? null;
  provenance.disclosures.consent.required = requiredConsent ?? null;
  provenance.disclosures.consent.acknowledged = acknowledgedConsent ?? null;

  const requiredCoe = accessContext?.policies.councilOfEuropeDisclosureVersion ?? null;
  const acknowledgedCoe = requiredCoe ?? null;
  provenance.disclosures.council_of_europe.required = requiredCoe ?? null;
  provenance.disclosures.council_of_europe.acknowledged = acknowledgedCoe;

  provenance.disclosures.satisfied = Boolean(
    (!requiredConsent || acknowledgedConsent === requiredConsent) &&
      (!requiredCoe || acknowledgedCoe === requiredCoe),
  );
}

function deriveComplianceContext(accessContext: OrgAccessContext | null | undefined): ComplianceContext {
  return {
    requiredConsentVersion: accessContext?.consent.requiredVersion ?? null,
    acknowledgedConsentVersion: accessContext?.consent.latestAcceptedVersion ?? null,
    requiredCoeVersion: accessContext?.policies.councilOfEuropeDisclosureVersion ?? null,
    acknowledgedCoeVersion: accessContext?.policies.councilOfEuropeDisclosureVersion ?? null,
  };
}

function augmentProvenanceFromSnippets(payload: IRACPayload, snippets: HybridSnippet[]): void {
  const provenance = ensureProvenance(payload);
  const eliSet = new Set(provenance.eli ?? []);
  const ecliSet = new Set(provenance.ecli ?? []);
  const feedCounter = new Map<string, number>();
  let akomaArticles = provenance.akoma_articles ?? 0;

  for (const snippet of snippets) {
    if (snippet.eli) {
      eliSet.add(snippet.eli);
    }
    if (snippet.ecli) {
      ecliSet.add(snippet.ecli);
    }
    if (typeof snippet.akomaArticleCount === 'number' && snippet.akomaArticleCount > 0) {
      akomaArticles += snippet.akomaArticleCount;
    }
    const zone = typeof snippet.residencyZone === 'string' ? snippet.residencyZone.toLowerCase() : '';
    if (zone && (zone.includes('maghreb') || zone.includes('rwanda'))) {
      feedCounter.set(zone, (feedCounter.get(zone) ?? 0) + 1);
    }
  }

  provenance.eli = Array.from(eliSet);
  provenance.ecli = Array.from(ecliSet);
  provenance.akoma_articles = akomaArticles;
  provenance.feeds = Array.from(feedCounter.entries()).map(([region, count]) => ({ region, count }));
}

function augmentProvenanceWithCaseAlignments(
  payload: IRACPayload,
  alignments: StatuteAlignmentDetail[],
): void {
  const provenance = ensureProvenance(payload);
  if (!Array.isArray(alignments) || alignments.length === 0) {
    return;
  }
  const existing = provenance.statute_alignments ?? [];
  const combined = [...existing];
  for (const alignment of alignments) {
    if (!alignment.caseUrl || !alignment.statuteUrl) {
      continue;
    }
    combined.push({
      case_url: alignment.caseUrl,
      statute_url: alignment.statuteUrl,
      article: alignment.article,
      alignment_score: alignment.alignmentScore,
    });
  }
  provenance.statute_alignments = combined;
}

function flagQuarantine(payload: IRACPayload, reason: string): void {
  const provenance = ensureProvenance(payload);
  provenance.quarantine.flagged = true;
  if (!provenance.quarantine.reason) {
    provenance.quarantine.reason = reason;
  }
}

function normaliseRuleKinds(payload: IRACPayload): void {
  if (!Array.isArray(payload.rules)) {
    return;
  }
  payload.rules = payload.rules.map((rule) => ({
    ...rule,
    kind:
      typeof rule.kind === 'string' && rule.kind.length > 0
        ? (rule.kind as IRACPayload['rules'][number]['kind'])
        : 'statute',
  }));
}

function resolveAgentProfile(
  agentCode: string | null | undefined,
  agentSettings: Record<string, unknown> | null | undefined,
): SelectedAgentProfile {
  const key = resolveAgentKey(agentCode);
  const definition = getAgentDefinition(key);
  const settings = normaliseAgentSettings(agentSettings ?? null);
  const { manifestTools, allowedKeys, overrideApplied } = deriveAllowedToolKeys(definition, settings);
  const label = typeof definition.label === 'string' ? definition.label : definition.code ?? key;
  const mission = typeof definition.mission === 'string' ? definition.mission : null;
  const manifestCode = typeof definition.code === 'string' ? definition.code : key;

  return {
    key,
    manifestCode,
    label,
    mission,
    declaredTools: manifestTools,
    allowedToolKeys: allowedKeys,
    settings,
    allowOverrideApplied: overrideApplied,
  };
}

function countAkomaArticles(value: unknown): number {
  if (!value || typeof value !== 'object') {
    return 0;
  }
  const record = value as Record<string, unknown>;
  const body = record.body as Record<string, unknown> | undefined;
  if (!body || typeof body !== 'object') {
    return 0;
  }
  const articles = body.articles;
  if (Array.isArray(articles)) {
    return articles.length;
  }
  return 0;
}

interface PlannerOutcome {
  planTrace: AgentPlanStep[];
  context: AgentExecutionContext;
  initialRouting: RoutingResult;
  hybridSnippets: HybridSnippet[];
  ohadaInsight: string | null;
  deadlineInsight: string | null;
  franceAnalyticsGuard: FranceAnalyticsGuardResult;
  agentProfile: SelectedAgentProfile;
}

type PlanStepOptions<T> = {
  optional?: boolean;
  detail?: (result: T) => Record<string, unknown> | null;
};

function consumeToolBudget(context: AgentExecutionContext, toolName: string): void {
  const remaining = context.toolBudgets[toolName] ?? Infinity;
  const used = context.toolUsage[toolName] ?? 0;
  if (used >= remaining) {
    throw new Error(`tool_budget_exceeded:${toolName}`);
  }
  context.toolUsage[toolName] = used + 1;
}

async function recordPlanStep<T>(
  trace: AgentPlanStep[],
  id: string,
  name: string,
  description: string,
  executor: () => Promise<T>,
  options?: PlanStepOptions<T>,
): Promise<T | null> {
  const started = new Date();
  let status: AgentPlanStep['status'] = 'success';
  let attempts = 0;
  let detail: Record<string, unknown> | null = null;
  if (typeof executor !== 'function') {
    throw new TypeError(`executor is not a function for plan step ${id} (args=${arguments.length})`);
  }
  try {
    attempts += 1;
    const result = await executor();
    if (options?.detail) {
      detail = options.detail(result);
    }
    const finished = new Date();
    trace.push({
      id,
      name,
      description,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      status,
      attempts,
      detail,
    });
    return result;
  } catch (error) {
    status = options?.optional ? 'skipped' : 'failed';
    const finished = new Date();
    detail = {
      error: error instanceof Error ? error.message : String(error),
    };
    trace.push({
      id,
      name,
      description,
      startedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      status,
      attempts,
      detail,
    });
    if (options?.optional) {
      return null;
    }
    throw error;
  }
}

function summariseHybridSnippets(snippets: HybridSnippet[]): Record<string, unknown> {
  const originCounts: Record<string, number> = {};
  for (const snippet of snippets) {
    originCounts[snippet.origin] = (originCounts[snippet.origin] ?? 0) + 1;
  }
  const sample = snippets.slice(0, 3).map((snippet) => ({
    origin: snippet.origin,
    trustTier: snippet.trustTier ?? null,
    url: snippet.url ?? null,
  }));
  return {
    total: snippets.length,
    origins: originCounts,
    sample,
  };
}

function createRunKey(
  input: AgentRunInput,
  routing: RoutingResult,
  confidentialMode: boolean,
  profile: SelectedAgentProfile,
): string {
  const hash = createHash('sha256');
  hash.update(input.orgId);
  hash.update('|');
  hash.update(input.userId);
  hash.update('|');
  hash.update(input.question.trim());
  hash.update('|');
  hash.update((input.context ?? '').trim());
  hash.update('|');
  hash.update(confidentialMode ? 'confidential' : 'standard');
  if (routing.primary?.country) {
    hash.update('|');
    hash.update(routing.primary.country);
  }
  hash.update('|');
  hash.update(profile.manifestCode);
  const sortedTools = [...profile.allowedToolKeys].sort();
  if (sortedTools.length > 0) {
    hash.update('|tools:');
    hash.update(sortedTools.join(','));
  }
  const settingsEntries = Object.entries(profile.settings).sort(([a], [b]) => a.localeCompare(b));
  if (settingsEntries.length > 0) {
    hash.update('|settings:');
    for (const [key, value] of settingsEntries) {
      hash.update(key);
      hash.update('=');
      hash.update(
        typeof value === 'string'
          ? value
          : JSON.stringify(value ?? null),
      );
      hash.update(';');
    }
  }
  return hash.digest('hex');
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  }
  return value;
}

const RESIDENCY_ZONE_NOTICES: Record<string, string> = {
  eu: 'Résidence de données : toutes les opérations restent dans l’espace UE/EEE conformément à la politique de résidence.',
  ohada:
    'Résidence de données : traitement limité aux infrastructures approuvées dans l’espace OHADA. Vérifiez les exigences locales additionnelles avant export.',
  ch: 'Résidence de données : conservation en Suisse (cantons francophones) selon les exigences de confidentialité helvétiques.',
  ca: 'Résidence de données : stockage et traitement au Canada / Québec ; respecter les obligations de la Loi sur la protection des renseignements personnels.',
  rw: 'Résidence de données : hébergement au Rwanda conformément aux directives du Ministry of Justice / RLRC.',
  maghreb:
    'Résidence de données : stockage dans l’enveloppe Maghreb ; appliquer les restrictions locales sur les transferts transfrontaliers.',
};

function resolveResidencyZone(accessContext: OrgAccessContext | null | undefined): string | null {
  if (!accessContext) {
    return null;
  }
  const abacZone = accessContext.abac?.residencyZone ?? null;
  if (abacZone) {
    return abacZone.toLowerCase();
  }

  const raw = (accessContext.rawPolicies ?? {})['residency_zone'];
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    return raw.toLowerCase();
  }
  if (typeof raw === 'object') {
    const candidate =
      (raw as { zone?: string }).zone ??
      (raw as { code?: string }).code ??
      (raw as { value?: string }).value ??
      null;
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate.toLowerCase();
    }
  }
  return null;
}

function buildRunNotices(
  payload: IRACPayload,
  options: { accessContext?: OrgAccessContext | null; confidentialMode: boolean; initialRouting?: RoutingResult | null },
): AgentPlanNotice[] {
  const notices: AgentPlanNotice[] = [];
  const residencyZone = resolveResidencyZone(options.accessContext);
  if (residencyZone && RESIDENCY_ZONE_NOTICES[residencyZone]) {
    notices.push({ type: 'residency', message: RESIDENCY_ZONE_NOTICES[residencyZone] });
  }

  const ohadaActive = Boolean(payload.jurisdiction?.ohada) || Boolean(options.initialRouting?.primary?.ohada);
  if (ohadaActive) {
    notices.push({
      type: 'ohada',
      message:
        "Zone OHADA : appliquez en priorité les Actes uniformes et la jurisprudence CCJA avant toute règle nationale complémentaire.",
    });
  }

  if (options.confidentialMode) {
    notices.push({
      type: 'confidential',
      message:
        'Mode confidentiel actif : la recherche web est désactivée et le cache hors ligne doit être purgé avant toute exportation.',
    });
  }

  return notices;
}

async function findExistingRun(
  runKey: string,
  orgId: string,
): Promise<
  | {
      id: string;
      payload: IRACPayload;
      plan: AgentPlanStep[];
      toolLogs: ToolInvocationLog[];
      confidentialMode: boolean;
      verification: VerificationResult;
      compliance: ComplianceAssessment | null;
    }
  | null
> {
  if (!runKey) {
    return null;
  }

  const existingQuery = await supabase
    .from('agent_runs')
    .select('id, irac, plan_trace, confidential_mode, verification_status, verification_notes')
    .eq('org_id', orgId)
    .eq('run_key', runKey)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingQuery.error) {
    console.warn('existing_run_lookup_failed', existingQuery.error.message);
    return null;
  }

  const row = existingQuery.data as {
    id?: string;
    irac?: IRACPayload;
    plan_trace?: unknown;
    confidential_mode?: boolean | null;
    verification_status?: VerificationStatus | null;
    verification_notes?: unknown;
  } | null;
  if (!row?.id || !row.irac) {
    return null;
  }

  const planTrace = Array.isArray(row.plan_trace)
    ? (row.plan_trace as AgentPlanStep[])
    : [];

  const toolRows = await supabase
    .from('tool_invocations')
    .select('tool_name, args, output')
    .eq('run_id', row.id)
    .order('created_at', { ascending: true });

  if (toolRows.error) {
    console.warn('existing_run_tool_lookup_failed', toolRows.error.message);
  }

  const toolLogs: ToolInvocationLog[] = (toolRows.data ?? []).map((toolRow) => ({
    name: typeof toolRow.tool_name === 'string' ? toolRow.tool_name : 'unknown',
    args: parseMaybeJson(toolRow.args),
    output: parseMaybeJson(toolRow.output),
  }));

  const verificationNotes = Array.isArray(row.verification_notes)
    ? (row.verification_notes as VerificationNote[])
    : [];

  const verification: VerificationResult = {
    status: row.verification_status ?? 'passed',
    notes: verificationNotes,
    allowlistViolations: [],
  };

  const compliance = await fetchComplianceAssessmentForRun(row.id as string, 'existing_run');

  return {
    id: row.id,
    payload: row.irac,
    plan: planTrace,
    toolLogs,
    confidentialMode: Boolean(row.confidential_mode),
    verification,
    compliance,
  };
}

function isRetryableAgentError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes('hors périmètre') || message.includes('guardrail');
}

async function planRun(
  input: AgentRunInput,
  accessContext: OrgAccessContext | null,
  useStub: boolean,
  toolLogs: ToolInvocationLog[],
  profile: SelectedAgentProfile,
): Promise<PlannerOutcome> {
  const planTrace: AgentPlanStep[] = [];

  await recordPlanStep<SelectedAgentProfile>(
    planTrace,
    'agent_selection',
    'Agent délégué',
    'Sélection du profil agent dans le manifeste Autonomous Suite.',
    async () => profile,
    {
      detail: (value) => ({
        manifestCode: value.manifestCode,
        label: value.label,
        declaredTools: value.declaredTools,
        allowedTools: value.allowedToolKeys,
        overrideApplied: value.allowOverrideApplied,
      }),
    },
  );

  const allowedToolKeys = profile.allowedToolKeys.length > 0
    ? Array.from(new Set(profile.allowedToolKeys))
    : Object.keys(TOOL_BUDGET_DEFAULTS);
  const toolBudgets = deriveToolBudgets(allowedToolKeys);

  const initialRouting =
    (await recordPlanStep<RoutingResult>(
      planTrace,
      'route_jurisdiction',
      'Analyse de juridiction',
      'Détection des juridictions pertinentes et des avertissements.',
      async () => detectJurisdiction(input.question, input.context),
    )) ?? { primary: null, candidates: [], warnings: [] };

  toolLogs.push({
    name: 'preflightRouting',
    args: { question: input.question, context: input.context },
    output: initialRouting,
  });

  const ohadaInsight = await recordPlanStep<string | null>(
    planTrace,
    'ohada_preemption',
    'Vérification OHADA',
    'Identifie les sujets OHADA et préemption potentielle.',
    async () => formatOhadaInsight(input.question, initialRouting),
    {
      optional: true,
      detail: (value) => (value ? { summary: value } : null),
    },
  );
  if (ohadaInsight) {
    toolLogs.push({ name: 'preflightOhada', args: { question: input.question }, output: ohadaInsight });
  }

  const deadlineInsight = await recordPlanStep<string | null>(
    planTrace,
    'deadline_estimate',
    'Estimation des délais',
    'Produit une estimation initiale des délais procéduraux.',
    async () => formatDeadlineInsight(input.question),
    {
      optional: true,
      detail: (value) => (value ? { summary: value } : null),
    },
  );
  if (deadlineInsight) {
    toolLogs.push({ name: 'preflightDeadline', args: { question: input.question }, output: deadlineInsight });
  }

  const allowedJurisdictions = accessContext
    ? Array.from(accessContext.entitlements.entries())
        .filter(([, value]) => value.canRead)
        .map(([code]) => code.toUpperCase())
    : [];

  const enforcedConfidentialMode = Boolean(accessContext?.policies.confidentialMode) || Boolean(input.confidentialMode);

  const residencyZone = resolveResidencyZone(accessContext);
  const sensitiveTopicHitlEnabled =
    accessContext?.abac?.sensitiveTopicHitl ?? accessContext?.policies.sensitiveTopicHitl ?? true;

  const synonymMap =
    (await recordPlanStep<Map<string, string[]>>(
      planTrace,
      'synonym_feedback',
      'Synonymes appris',
      'Injecte les synonymes validés par la boucle de learning dans la planification.',
      async () => fetchSynonymExpansions(initialRouting.primary?.country ?? null),
      {
        optional: true,
        detail: (value) =>
          value.size > 0
            ? {
                terms: Array.from(value.entries())
                  .slice(0, 5)
                  .map(([term, expansions]) => ({ term, expansions })),
                total: value.size,
              }
            : null,
      },
    )) ?? new Map<string, string[]>();

  const policyVersion =
    (await recordPlanStep<PolicyVersionContext | null>(
      planTrace,
      'policy_version',
      'Politique active',
      'Identifie la dernière version de politique/guardrail activée pour contextualiser la réponse.',
      async () => fetchActivePolicyVersion(),
      {
        optional: true,
        detail: (value) =>
          value
            ? {
                name: value.name,
                activatedAt: value.activatedAt,
                notes: value.notes ?? null,
              }
            : null,
      },
    )) ?? null;

  const synonymRecord: Record<string, string[]> = {};
  for (const [term, expansions] of synonymMap) {
    synonymRecord[term] = expansions;
  }

  const context: AgentExecutionContext = {
    orgId: input.orgId,
    userId: input.userId,
    allowlist: DOMAIN_ALLOWLIST,
    prompt: input.question,
    supplementalContext: input.context,
    initialRouting,
    lastJurisdiction: initialRouting.primary,
    confidentialMode: enforcedConfidentialMode,
    allowedJurisdictions,
    residencyZone,
    sensitiveTopicHitl: sensitiveTopicHitlEnabled,
    toolUsage: {},
    toolBudgets,
    synonymExpansions: synonymRecord,
    policyVersion,
    agentKey: profile.key,
    agentCode: profile.manifestCode,
    agentLabel: profile.label,
    agentSettings: profile.settings,
    allowedTools: allowedToolKeys,
  };

  if (enforcedConfidentialMode) {
    context.toolBudgets.web_search = 0;
  }

  if (
    accessContext &&
    initialRouting.primary?.country &&
    !isJurisdictionAllowed(accessContext.entitlements, initialRouting.primary.country)
  ) {
    const error = new Error('jurisdiction_not_entitled');
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }

  let hybridSnippets: HybridSnippet[] = [];
  if (useStub) {
    const now = new Date();
    planTrace.push({
      id: 'hybrid_retrieval',
      name: 'Contexte hybride',
      description: 'Mode stub actif – récupération hybride ignorée.',
      startedAt: now.toISOString(),
      finishedAt: now.toISOString(),
      status: 'skipped',
      attempts: 0,
      detail: { reason: 'stub_mode' },
    });
  } else {
    hybridSnippets =
      (await recordPlanStep<HybridSnippet[]>(
        planTrace,
        'hybrid_retrieval',
        'Récupération hybride',
        'Combine le vector store local et File Search pour pré-contextualiser la réponse.',
        async () =>
          fetchHybridSnippets(
            input.orgId,
            input.question,
            initialRouting.primary?.country ?? null,
            synonymMap,
          ),
        { detail: (snippets) => summariseHybridSnippets(snippets) },
      )) ?? [];

    if (hybridSnippets.length > 0) {
      toolLogs.push({
        name: 'hybridContext',
        args: { orgId: input.orgId, jurisdiction: initialRouting.primary?.country ?? null },
        output: hybridSnippets,
      });
    }
  }

  const franceAnalyticsGuard =
    (await recordPlanStep<FranceAnalyticsGuardResult>(
      planTrace,
      'france_judge_analytics_guard',
      'Contrôle analytics magistrats',
      'Vérifie si la requête enfreint l’interdiction française de profilage des juges.',
      async () =>
        accessContext?.policies.franceJudgeAnalyticsBlocked === false
          ? { triggered: false, rationale: '' }
          : enforceFranceJudgeAnalyticsBan(input.question, initialRouting),
      {
        detail: (value) => ({ triggered: value.triggered, rationale: value.rationale }),
      },
    )) ?? { triggered: false, rationale: '' };

  if (franceAnalyticsGuard.triggered) {
    const lastStep = planTrace[planTrace.length - 1];
    if (lastStep && lastStep.id === 'france_judge_analytics_guard') {
      lastStep.status = 'failed';
    }
  }

  return {
    planTrace,
    context,
    initialRouting,
    hybridSnippets,
    ohadaInsight: ohadaInsight ?? null,
    deadlineInsight: deadlineInsight ?? null,
    franceAnalyticsGuard,
    agentProfile: profile,
  };
}

async function executeAgentPlan(
  agent: Agent<AgentExecutionContext, typeof IRACSchema>,
  planner: PlannerOutcome,
  input: AgentRunInput,
  hybridSnippets: HybridSnippet[],
): Promise<{ payload: IRACPayload; allowlistViolations: string[]; attempts: number }>
{
  const context = planner.context;
  const prefaceSegments = [input.question];

  if (input.context) {
    prefaceSegments.push(`Contexte utilisateur:\n${input.context}`);
  }

  if (context.confidentialMode) {
    prefaceSegments.push(
      'Mode confidentiel activé : utilisez uniquement les documents déposés et les corpus internes ; ne lancez pas de recherche web.',
    );
  }

  const insights: string[] = [];
  if (planner.ohadaInsight) {
    insights.push(planner.ohadaInsight);
  }
  if (planner.deadlineInsight) {
    insights.push(planner.deadlineInsight);
  }
  if (insights.length > 0) {
    prefaceSegments.push(`Aperçu analytique:\n${insights.join('\n')}`);
  }

  const synonymPreface = formatSynonymPreface(
    new Map(Object.entries(context.synonymExpansions ?? {})),
  );
  if (synonymPreface) {
    prefaceSegments.push(synonymPreface);
  }

  if (context.policyVersion) {
    const note = context.policyVersion.notes ? ` – ${context.policyVersion.notes}` : '';
    prefaceSegments.push(
      `Politique active (${context.policyVersion.activatedAt}): ${context.policyVersion.name}${note}`,
    );
  }

  if (hybridSnippets.length > 0) {
    prefaceSegments.push(`Extraits du corpus officiel:\n${summariseSnippets(hybridSnippets)}`);
  }

  const basePrompt = prefaceSegments.join('\n\n');
  let prompt = basePrompt;
  let attempts = 0;
  const maxAttempts = 2;
  const startedAt = new Date();
  let lastError: unknown = null;

  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      const result = await runAgent(agent, prompt, { context, maxTurns: 8 });
      if (!result.finalOutput) {
        throw new Error('Réponse vide du moteur d’agent.');
      }

      const payload = result.finalOutput;
      const violations = payload.citations
        .filter((citation) => !isUrlAllowlisted(citation.url))
        .map((citation) => citation.url);

      const finishedAt = new Date();
      planner.planTrace.push({
        id: 'agent_execution',
        name: 'Exécution de l’agent',
        description: 'Génération de la réponse structurée via l’Agents SDK.',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        status: 'success',
        attempts,
        detail: { allowlistViolations: violations.length },
      });

      return { payload, allowlistViolations: violations, attempts };
    } catch (error) {
      lastError = error;
      if (attempts < maxAttempts && isRetryableAgentError(error)) {
        prompt = `${basePrompt}\n\nIMPORTANT : Reformule ta recherche en utilisant uniquement les domaines autorisés (${DOMAIN_ALLOWLIST.join(', ')}).`;
        continue;
      }

      const finishedAt = new Date();
      planner.planTrace.push({
        id: 'agent_execution',
        name: 'Exécution de l’agent',
        description: 'Génération de la réponse structurée via l’Agents SDK.',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        status: 'failed',
        attempts,
        detail: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }

  throw lastError ?? new Error('agent_execution_failed');
}

function shouldUseStubAgent(): boolean {
  if (stubMode === 'always') {
    return true;
  }
  if (stubMode === 'never') {
    return false;
  }
  return env.OPENAI_API_KEY === 'test' || env.AGENT_MODEL.includes('test');
}

let providerConfigured = false;
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

const citationsAllowlistGuardrail = defineOutputGuardrail<IRACPayload>({
  name: 'citations-allowlist',
  execute: async ({ agentOutput }) => {
    const violations = agentOutput.citations
      .filter((citation) => !isUrlAllowlisted(citation.url))
      .map((citation) => citation.url);

    return {
      tripwireTriggered: violations.length > 0,
      outputInfo: {
        violations,
      },
    };
  },
});

const bindingLanguageGuardrail = defineOutputGuardrail<IRACPayload>({
  name: 'binding-language-guardrail',
  execute: async ({ agentOutput }) => {
    const jurisdiction = agentOutput.jurisdiction?.country ?? null;
    const firstCitationUrl = agentOutput.citations.find((citation) => Boolean(citation.url))?.url;
    const info = determineBindingLanguage(jurisdiction, firstCitationUrl);
    const requiresBanner = info.requiresBanner;
    const tripwireTriggered = requiresBanner && agentOutput.risk.hitl_required !== true;

    return {
      tripwireTriggered,
      outputInfo: {
        requiresBanner,
        bindingLanguage: info.bindingLang,
        translationNotice: info.translationNotice,
      },
    };
  },
});

const structuredIracGuardrail = defineOutputGuardrail<IRACPayload>({
  name: 'structured-irac-guardrail',
  execute: async ({ agentOutput }) => {
    const missing: string[] = [];
    if (!agentOutput.issue || agentOutput.issue.trim().length === 0) {
      missing.push('issue');
    }
    if (!Array.isArray(agentOutput.rules) || agentOutput.rules.length === 0) {
      missing.push('rules');
    }
    if (!agentOutput.application || agentOutput.application.trim().length === 0) {
      missing.push('application');
    }
    if (!agentOutput.conclusion || agentOutput.conclusion.trim().length === 0) {
      missing.push('conclusion');
    }

    return {
      tripwireTriggered: missing.length > 0,
      outputInfo: { missing },
    };
  },
});

const sensitiveTopicGuardrail = defineOutputGuardrail<IRACPayload>({
  name: 'sensitive-topic-hitl-guardrail',
  execute: async ({ agentOutput }) => {
    const riskLevel = agentOutput.risk?.level ?? 'LOW';
    const tripwireTriggered = riskLevel === 'HIGH' && agentOutput.risk.hitl_required !== true;
    return {
      tripwireTriggered,
      outputInfo: {
        riskLevel,
        hitlRequired: agentOutput.risk.hitl_required,
      },
    };
  },
});

type GuardrailIdentifier = 'binding-language' | 'structured-irac' | 'sensitive-topic';

function identifyGuardrail(error: unknown): GuardrailIdentifier | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const message = error.message.toLowerCase();
  if (message.includes('binding-language-guardrail')) {
    return 'binding-language';
  }
  if (message.includes('structured-irac-guardrail')) {
    return 'structured-irac';
  }
  if (message.includes('sensitive-topic-hitl-guardrail')) {
    return 'sensitive-topic';
  }
  return null;
}

const OHADA_MEMBERS = [
  'Benin',
  'Burkina Faso',
  'Cameroon',
  'Central African Republic',
  'Chad',
  'Comoros',
  'Congo',
  'Côte d\u2019Ivoire',
  'Cote d\'Ivoire',
  'Democratic Republic of the Congo',
  'Equatorial Guinea',
  'Gabon',
  'Guinea',
  'Guinea-Bissau',
  'Mali',
  'Niger',
  'Senegal',
  'Togo',
];

const OHADA_TOPIC_MAP: Record<string, { act: string; articles: string[]; note: string }> = {
  surete: {
    act: 'Acte uniforme portant organisation des sûretés',
    articles: ['1', '2', '3', '4'],
    note: 'Version du 15 décembre 2010 en vigueur depuis 2011-05-16.',
  },
  sûretés: {
    act: 'Acte uniforme portant organisation des sûretés',
    articles: ['1', '2', '3', '4'],
    note: 'Version du 15 décembre 2010 en vigueur depuis 2011-05-16.',
  },
  recouvrement: {
    act: 'Acte uniforme organisant les procédures simplifiées de recouvrement et les voies d\'exécution',
    articles: ['3', '10', '28'],
    note: 'Version du 17 octobre 2022 en vigueur depuis 2023-01-17.',
  },
  société: {
    act: 'Acte uniforme relatif au droit des sociétés commerciales et du GIE (AUSCGIE)',
    articles: ['40', '269'],
    note: 'Version révisée du 30 janvier 2014 en vigueur depuis 2014-05-05.',
  },
  societe: {
    act: 'Acte uniforme relatif au droit des sociétés commerciales et du GIE (AUSCGIE)',
    articles: ['40', '269'],
    note: 'Version révisée du 30 janvier 2014 en vigueur depuis 2014-05-05.',
  },
};

const DEFAULT_LIMITATIONS: Record<string, { years: number; reference: string }> = {
  FR: { years: 5, reference: 'Prescription quinquennale (Code civil art. 2224).' },
  'CA-QC': { years: 3, reference: 'Prescription de trois ans (C.c.Q., art. 2925).' },
  BE: { years: 5, reference: 'Prescription de droit commun (Code civil art. 2262bis).' },
  LU: { years: 3, reference: 'Prescription triennale (Code civil luxembourgeois).' },
};

const FR_JUDGE_ANALYTICS_ARTICLE = {
  citation: "Code de l'organisation judiciaire, art. L10",
  sourceUrl: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000038287787/',
  effectiveDate: '2019-03-25',
  note: "Interdit l'analyse prédictive ou statistique sur le comportement des magistrats.",
};

const LEGAL_INTEREST_DEFAULT: Record<string, number> = {
  FR: 0.04,
  'CA-QC': 0.05,
  BE: 0.05,
  LU: 0.05,
  OHADA: 0.05,
};

const DEADLINE_DEFAULT_DAYS = 30;

type BindingLanguageInfo = {
  jurisdiction: string;
  bindingLang: string;
  translationNotice?: string;
  requiresBanner: boolean;
  source: string;
};

const MAGHREB_JURISDICTIONS = new Set(['MA', 'TN', 'DZ']);

const GO_NO_GO_CRITERIA = {
  cepej: { section: 'A', criterion: 'CEPEJ 5 principles automated checks' },
  statute: { section: 'C', criterion: 'Statute-first policy enforced' },
  disclosures: { section: 'A', criterion: 'Client disclosures & Council of Europe confirmations' },
  franceJudgeAnalytics: { section: 'A', criterion: 'France judge-analytics ban enforced' },
  ohadaPreemption: { section: 'A', criterion: 'OHADA pre-emption banner enforced' },
  maghrebBinding: { section: 'C', criterion: 'Maghreb binding-language banners' },
  confidentialMode: { section: 'D', criterion: 'Confidential mode hardening' },
} as const;

type GoNoGoCriterionKey = keyof typeof GO_NO_GO_CRITERIA;

interface GoNoGoEvidenceContext {
  orgId: string;
  actorId: string;
  runId: string;
  compliance?: ComplianceAssessment | null;
  bindingInfo?: (BindingLanguageInfo & { rationale: string }) | null;
  notices?: AgentPlanNotice[];
  confidentialMode?: boolean;
  jurisdiction?: IRACPayload['jurisdiction'];
  franceAnalyticsBlocked?: boolean;
}

function buildEvidenceNotes(base: Record<string, unknown>): Record<string, unknown> | null {
  const cleanedEntries = Object.entries(base).filter(([, value]) => value !== undefined);
  if (cleanedEntries.length === 0) {
    return null;
  }
  return Object.fromEntries(cleanedEntries);
}

async function upsertGoNoGoEvidence(
  orgId: string,
  actorId: string,
  key: GoNoGoCriterionKey,
  status: 'pending' | 'satisfied',
  notes: Record<string, unknown> | null,
): Promise<void> {
  const target = GO_NO_GO_CRITERIA[key];
  const payload = {
    org_id: orgId,
    section: target.section,
    criterion: target.criterion,
    status,
    notes,
    recorded_by: actorId,
    recorded_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from('go_no_go_evidence')
    .upsert(payload, { onConflict: 'org_id,section,criterion' });
  if (error) {
    console.warn('go_no_go_evidence_upsert_failed', {
      criterion: target.criterion,
      error: error.message,
    });
  }
}

async function recordGoNoGoEvidenceForRun(context: GoNoGoEvidenceContext): Promise<void> {
  const {
    orgId,
    actorId,
    runId,
    compliance,
    bindingInfo = null,
    notices = [],
    confidentialMode = false,
    jurisdiction,
    franceAnalyticsBlocked = false,
  } = context;

  try {
    const updates: Array<Promise<void>> = [];

    if (compliance) {
      updates.push(
        upsertGoNoGoEvidence(
          orgId,
          actorId,
          'cepej',
          compliance.cepej.passed ? 'satisfied' : 'pending',
          buildEvidenceNotes({
            runId,
            violations: compliance.cepej.violations,
            friaRequired: compliance.fria.required,
            friaReasons: compliance.fria.reasons,
          }),
        ),
      );

      updates.push(
        upsertGoNoGoEvidence(
          orgId,
          actorId,
          'statute',
          compliance.statute.passed ? 'satisfied' : 'pending',
          buildEvidenceNotes({ runId, violations: compliance.statute.violations }),
        ),
      );

      updates.push(
        upsertGoNoGoEvidence(
          orgId,
          actorId,
          'disclosures',
          compliance.disclosures.missing.length === 0 ? 'satisfied' : 'pending',
          buildEvidenceNotes({
            runId,
            missing: compliance.disclosures.missing,
            consentSatisfied: compliance.disclosures.consentSatisfied,
            councilSatisfied: compliance.disclosures.councilSatisfied,
          }),
        ),
      );
    }

    if (franceAnalyticsBlocked) {
      updates.push(
        upsertGoNoGoEvidence(
          orgId,
          actorId,
          'franceJudgeAnalytics',
          'satisfied',
          buildEvidenceNotes({ runId }),
        ),
      );
    }

    const jurisdictionCode = jurisdiction?.country?.toUpperCase() ?? null;
    const isOhada = Boolean(jurisdiction?.ohada) || jurisdictionCode === 'OHADA';
    if (isOhada) {
      const ohadaNotice = notices.some((notice) => notice.type === 'ohada');
      updates.push(
        upsertGoNoGoEvidence(
          orgId,
          actorId,
          'ohadaPreemption',
          ohadaNotice ? 'satisfied' : 'pending',
          buildEvidenceNotes({
            runId,
            jurisdiction: jurisdictionCode,
            notice: ohadaNotice
              ? notices.find((notice) => notice.type === 'ohada')?.message ?? null
              : null,
          }),
        ),
      );
    }

    const bindingJurisdiction = bindingInfo?.jurisdiction?.toUpperCase() ?? jurisdictionCode;
    if (bindingJurisdiction && MAGHREB_JURISDICTIONS.has(bindingJurisdiction)) {
      updates.push(
        upsertGoNoGoEvidence(
          orgId,
          actorId,
          'maghrebBinding',
          bindingInfo?.requiresBanner ? 'satisfied' : 'pending',
          buildEvidenceNotes({
            runId,
            jurisdiction: bindingJurisdiction,
            bindingLanguage: bindingInfo?.bindingLang,
            translationNotice: bindingInfo?.translationNotice ?? null,
          }),
        ),
      );
    }

    if (confidentialMode) {
      const confidentialNotice = notices.some((notice) => notice.type === 'confidential');
      updates.push(
        upsertGoNoGoEvidence(
          orgId,
          actorId,
          'confidentialMode',
          confidentialNotice ? 'satisfied' : 'pending',
          buildEvidenceNotes({
            runId,
            notice: confidentialNotice
              ? notices.find((notice) => notice.type === 'confidential')?.message ?? null
              : null,
          }),
        ),
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  } catch (error) {
    console.warn('go_no_go_evidence_record_failed', error);
  }
}

const JURISDICTION_BINDING_RULES: Record<string, BindingLanguageInfo> = {
  MA: {
    jurisdiction: 'MA',
    bindingLang: 'ar',
    translationNotice:
      'La version française du Bulletin officiel est une traduction informative; seule la version arabe fait foi.',
    requiresBanner: true,
    source: 'Bulletin officiel du Royaume du Maroc (sgg.gov.ma) – édition de traduction officielle.',
  },
  TN: {
    jurisdiction: 'TN',
    bindingLang: 'ar',
    translationNotice:
      'La version arabe du Journal Officiel de la République Tunisienne fait foi; la version française est informative.',
    requiresBanner: true,
    source: 'Imprimerie Officielle de Tunisie (iort.gov.tn).',
  },
  DZ: {
    jurisdiction: 'DZ',
    bindingLang: 'ar',
    translationNotice:
      'La version arabe du Journal officiel algérien est contraignante; la version française accompagne pour information.',
    requiresBanner: true,
    source: 'Journal officiel de la République algérienne démocratique et populaire (joradp.dz).',
  },
  'CA-QC': {
    jurisdiction: 'CA-QC',
    bindingLang: 'fr/en',
    translationNotice:
      'Au Québec comme au Canada, les versions française et anglaise ont la même valeur juridique. Vérifiez les deux versions lorsque cela est pertinent.',
    requiresBanner: false,
    source: 'Charte de la langue française (Québec) et Loi sur les langues officielles (Canada).',
  },
  CA: {
    jurisdiction: 'CA',
    bindingLang: 'fr/en',
    translationNotice:
      'Les textes fédéraux canadiens sont publiés dans les deux langues officielles et ont une valeur juridique équivalente.',
    requiresBanner: false,
    source: 'Loi sur les langues officielles et Loi sur les textes législatifs.',
  },
  CH: {
    jurisdiction: 'CH',
    bindingLang: 'fr/de/it',
    translationNotice:
      'Les textes suisses doivent être vérifiés dans les versions française et allemande lorsqu’elles existent.',
    requiresBanner: false,
    source: 'Fedlex et Tribunal fédéral publient les textes dans plusieurs langues officielles.',
  },
  RW: {
    jurisdiction: 'RW',
    bindingLang: 'rw/en',
    translationNotice:
      'La Gazette officielle du Rwanda est publiée en kinyarwanda et en anglais; les versions françaises doivent être vérifiées.',
    requiresBanner: false,
    source: 'Ministry of Justice / Rwanda Law Reform Commission gazettes.',
  },
};

const DOMAIN_BINDING_RULES: Record<string, BindingLanguageInfo> = {
  'sgg.gov.ma': JURISDICTION_BINDING_RULES.MA,
  'iort.gov.tn': JURISDICTION_BINDING_RULES.TN,
  'joradp.dz': JURISDICTION_BINDING_RULES.DZ,
  'minijust.gov.rw': JURISDICTION_BINDING_RULES.RW,
  'amategeko.gov.rw': JURISDICTION_BINDING_RULES.RW,
  'rlrc.gov.rw': JURISDICTION_BINDING_RULES.RW,
  'judiciary.gov.rw': JURISDICTION_BINDING_RULES.RW,
  'laws-lois.justice.gc.ca': JURISDICTION_BINDING_RULES['CA-QC'],
  'canlii.org': JURISDICTION_BINDING_RULES['CA-QC'],
  'legisquebec.gouv.qc.ca': JURISDICTION_BINDING_RULES['CA-QC'],
  'fedlex.admin.ch': JURISDICTION_BINDING_RULES.CH,
  'bger.ch': JURISDICTION_BINDING_RULES.CH,
};

function isUrlAllowlisted(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return DOMAIN_ALLOWLIST.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch (error) {
    return false;
  }
}

function detectJurisdiction(question: string, context?: string): RoutingResult {
  const haystack = `${question}\n${context ?? ''}`;
  const candidates: JurisdictionHint[] = [];

  const ROUTING_KEYWORDS: Array<{
    code: string;
    eu: boolean;
    ohada: boolean;
    patterns: RegExp[];
    rationale: string;
  }> = [
    {
      code: 'FR',
      eu: true,
      ohada: false,
      rationale: 'Mots-clés français (Paris, Légifrance, Code civil).',
      patterns: [/france/i, /paris/i, /l\u00e9gifrance/i, /code\s+civil/i, /cassation\s+fran\w*/i],
    },
    {
      code: 'BE',
      eu: true,
      ohada: false,
      rationale: 'Références belges (Moniteur, Justel, Bruxelles).',
      patterns: [/belg/i, /moniteur/i, /justel/i, /bruxelles/i],
    },
    {
      code: 'LU',
      eu: true,
      ohada: false,
      rationale: 'Mentions luxembourgeoises (Legilux, Luxembourg).',
      patterns: [/luxembourg/i, /legilux/i],
    },
    {
      code: 'MC',
      eu: false,
      ohada: false,
      rationale: 'Mentions monégasques.',
      patterns: [/monaco/i, /l\u00e9gimonaco/i],
    },
    {
      code: 'CH',
      eu: false,
      ohada: false,
      rationale: 'Indices suisses (Fedlex, canton francophone).',
      patterns: [/suisse/i, /fedlex/i, /tribunal f\u00e9d\u00e9ral/i, /lausanne/i, /gen\u00e8ve/i],
    },
    {
      code: 'CA-QC',
      eu: false,
      ohada: false,
      rationale: 'Références québécoises (Code civil du Québec, CanLII).',
      patterns: [/qu[ée]bec/i, /canlii/i, /c\.p\.c\./i, /c\.c\.q\./i],
    },
    {
      code: 'MA',
      eu: false,
      ohada: false,
      rationale: 'Références marocaines (BO, Rabat).',
      patterns: [/maroc/i, /rabat/i, /bulletin officiel/i],
    },
    {
      code: 'TN',
      eu: false,
      ohada: false,
      rationale: 'Références tunisiennes (JORT, Tunis).',
      patterns: [/tunisie/i, /jort/i, /tunis/i],
    },
    {
      code: 'DZ',
      eu: false,
      ohada: false,
      rationale: 'Références algériennes (JORADP, Alger).',
      patterns: [/alg[ée]rie/i, /joradp/i, /alger/i],
    },
    {
      code: 'OHADA',
      eu: false,
      ohada: true,
      rationale: "Mention explicite de l'OHADA ou d'un État membre.",
      patterns: [/ohada/i, /ccja/i, ...OHADA_MEMBERS.map((member) => new RegExp(member, 'i'))],
    },
  ];

  for (const entry of ROUTING_KEYWORDS) {
    let score = 0;
    for (const pattern of entry.patterns) {
      if (pattern.test(haystack)) {
        score += 1;
      }
    }
    if (score > 0) {
      const confidence = Math.min(1, 0.4 + score * 0.2);
      candidates.push({
        country: entry.code,
        eu: entry.eu,
        ohada: entry.ohada,
        confidence,
        rationale: entry.rationale,
      });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const primary = candidates.length > 0 ? candidates[0] : null;

  const warnings: string[] = [];
  if (!primary) {
    warnings.push('Aucune juridiction explicite détectée; demander confirmation utilisateur.');
  }
  if (primary?.ohada) {
    warnings.push('Prioriser les Actes uniformes OHADA et la jurisprudence CCJA.');
  }

  return {
    primary,
    candidates,
    warnings,
  };
}

function runDeadlineCalculator(reference: string, explicitStartDate?: string): { deadline: string; reasoning: string } {
  const match = explicitStartDate ? null : reference.match(/(\d{4}-\d{2}-\d{2})/);
  const startDate = explicitStartDate ? new Date(explicitStartDate) : match ? new Date(match[1]) : new Date();
  const deadlineDate = new Date(startDate);
  deadlineDate.setDate(deadlineDate.getDate() + DEADLINE_DEFAULT_DAYS);

  return {
    deadline: deadlineDate.toISOString().slice(0, 10),
    reasoning: `Hypothèse par défaut: délai de ${DEADLINE_DEFAULT_DAYS} jours à compter du ${startDate
      .toISOString()
      .slice(0, 10)} (à affiner selon la procédure).`,
  };
}

function resolveOhadaTopic(question: string): { key: string; data: { act: string; articles: string[]; note: string } } | null {
  const normalized = question.toLowerCase();
  for (const [key, data] of Object.entries(OHADA_TOPIC_MAP)) {
    if (normalized.includes(key)) {
      return { key, data };
    }
  }
  return null;
}

function determineBindingLanguage(
  jurisdictionHint: string | null,
  url?: string,
): BindingLanguageInfo & { rationale: string } {
  if (url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (DOMAIN_BINDING_RULES[host]) {
        const info = DOMAIN_BINDING_RULES[host];
        return { ...info, rationale: `Règle spécifique au domaine ${host}.` };
      }
      const parts = host.split('.');
      while (parts.length > 2) {
        parts.shift();
        const candidate = parts.join('.');
        if (DOMAIN_BINDING_RULES[candidate]) {
          const info = DOMAIN_BINDING_RULES[candidate];
          return { ...info, rationale: `Règle spécifique au domaine ${candidate}.` };
        }
      }
    } catch (error) {
      // ignore malformed URL; fallback to jurisdiction
    }
  }

  if (jurisdictionHint && JURISDICTION_BINDING_RULES[jurisdictionHint]) {
    const info = JURISDICTION_BINDING_RULES[jurisdictionHint];
    return { ...info, rationale: `Règle linguistique propre à la juridiction ${jurisdictionHint}.` };
  }

  const fallback: BindingLanguageInfo = {
    jurisdiction: jurisdictionHint ?? 'FR',
    bindingLang: 'fr',
    translationNotice: 'Le texte officiel en français fait foi; vérifier les consolidations.',
    requiresBanner: false,
    source: 'Portails officiels francophones (Légifrance, Justel, Legilux, etc.).',
  };
  return { ...fallback, rationale: 'Aucune règle spécifique détectée; application du régime francophone par défaut.' };
}

async function fetchSynonymExpansions(
  jurisdiction: string | null,
): Promise<Map<string, string[]>> {
  const codes = new Set<string>(['GLOBAL']);
  if (jurisdiction) {
    codes.add(jurisdiction.toUpperCase());
  }

  const { data, error } = await supabase
    .from('agent_synonyms')
    .select('term, expansions, jurisdiction')
    .in('jurisdiction', Array.from(codes))
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('synonym_lookup_failed', error.message);
    return new Map();
  }

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const term = typeof row.term === 'string' ? row.term : null;
    const expansions = Array.isArray(row.expansions)
      ? (row.expansions as unknown[])
          .map((value) => (typeof value === 'string' ? value : null))
          .filter((value): value is string => Boolean(value))
      : [];
    if (!term || expansions.length === 0) {
      continue;
    }
    if (!map.has(term)) {
      map.set(term, expansions);
    }
  }
  return map;
}

async function fetchActivePolicyVersion(): Promise<PolicyVersionContext | null> {
  const { data, error } = await supabase
    .from('agent_policy_versions')
    .select('name, activated_at, notes')
    .not('activated_at', 'is', null)
    .order('activated_at', { ascending: false })
    .limit(1);

  if (error) {
    console.warn('policy_version_lookup_failed', error.message);
    return null;
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  if (!row || typeof row !== 'object' || !row.activated_at || !row.name) {
    return null;
  }

  return {
    name: String(row.name),
    activatedAt: String(row.activated_at),
    notes: typeof row.notes === 'string' ? row.notes : null,
  };
}

function formatSynonymPreface(map: Map<string, string[]>): string | null {
  if (map.size === 0) {
    return null;
  }
  const segments: string[] = [];
  for (const [term, expansions] of map) {
    if (expansions.length === 0) {
      continue;
    }
    segments.push(`${term}: ${expansions.join(', ')}`);
  }
  if (segments.length === 0) {
    return null;
  }
  return `Termes appris / synonymes utiles:\n${segments.join('\n')}`;
}

function augmentQuestionWithSynonyms(question: string, map: Map<string, string[]>): string {
  if (map.size === 0) {
    return question;
  }
  const additions: string[] = [];
  for (const [term, expansions] of map) {
    if (!question.toLowerCase().includes(term.toLowerCase()) && expansions.length > 0) {
      continue;
    }
    additions.push(`${term}: ${expansions.join(', ')}`);
  }
  if (additions.length === 0) {
    return question;
  }
  return `${question}\n\nSynonymes pertinents : ${additions.join(' | ')}`;
}

async function embedQuestionForHybrid(question: string): Promise<number[] | null> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.EMBEDDING_MODEL,
      input: question,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message ?? 'embedding_failed';
    throw new Error(message);
  }

  const data = Array.isArray(json?.data) ? json.data : [];
  if (data.length === 0 || !Array.isArray(data[0]?.embedding)) {
    return null;
  }

  return data[0].embedding as number[];
}

async function queryFileSearchResults(
  question: string,
  maxResults: number,
): Promise<Array<{ content: string; score: number; fileId: string | null }>> {
  if (!env.OPENAI_VECTOR_STORE_AUTHORITIES_ID || env.OPENAI_VECTOR_STORE_AUTHORITIES_ID === 'vs_test') {
    return [];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.AGENT_MODEL,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: question,
              },
            ],
          },
        ],
        tools: [{ type: 'file_search' }],
        tool_choice: { type: 'tool', function: { name: 'file_search' } },
        tool_resources: {
          file_search: {
            vector_store_ids: [env.OPENAI_VECTOR_STORE_AUTHORITIES_ID],
          },
        },
        metadata: { purpose: 'hybrid_retrieval_probe' },
        max_output_tokens: 1,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const message = errorBody?.error?.message ?? 'file_search_failed';
      console.warn('file_search_request_failed', message);
      return [];
    }

    const payload = await response.json();
    const results: Array<{ content: string; score: number; fileId: string | null }> = [];

    const visit = (node: unknown): void => {
      if (!node) {
        return;
      }
      if (Array.isArray(node)) {
        for (const entry of node) {
          visit(entry);
        }
        return;
      }
      if (typeof node !== 'object') {
        return;
      }

      const maybe = node as Record<string, unknown>;
      if (maybe.file_search && typeof maybe.file_search === 'object') {
        const candidate = maybe.file_search as { results?: unknown };
        if (Array.isArray(candidate.results)) {
          for (const raw of candidate.results) {
            if (!raw || typeof raw !== 'object') continue;
            const rawRecord = raw as Record<string, unknown>;
            const fileId = typeof rawRecord.file_id === 'string' ? rawRecord.file_id : null;
            const score = typeof rawRecord.score === 'number' ? rawRecord.score : 0;
            let content = '';
            if (Array.isArray(rawRecord.content)) {
              for (const segment of rawRecord.content) {
                if (!segment || typeof segment !== 'object') continue;
                const typed = segment as Record<string, unknown>;
                if (typeof typed.text === 'string' && typed.text.trim().length > 0) {
                  content = typed.text.trim();
                  break;
                }
              }
            }
            if (!content && typeof rawRecord.text === 'string') {
              content = rawRecord.text.trim();
            }
            if (content.length > 0) {
              results.push({ content: content.slice(0, 600), score, fileId });
            }
          }
        }
      }

      for (const value of Object.values(maybe)) {
        visit(value);
      }
    };

    visit(payload);

    return results.slice(0, maxResults);
  } catch (error) {
    console.warn('file_search_query_error', error);
    return [];
  }
}

async function fetchHybridSnippets(
  orgId: string,
  question: string,
  jurisdiction: string | null,
  synonyms: Map<string, string[]>,
): Promise<HybridSnippet[]> {
  try {
    const augmentedQuestion = augmentQuestionWithSynonyms(question, synonyms);
    const embedding = await embedQuestionForHybrid(augmentedQuestion);
    if (!embedding) {
      return [];
    }

    const { data, error } = await supabase.rpc('match_chunks', {
      p_org: orgId,
      p_query_embedding: embedding,
      p_match_count: 8,
      p_jurisdiction: jurisdiction ?? null,
    });

    if (error) {
      console.warn('hybrid_context_rpc_failed', error.message);
    }

    const normalized = Array.isArray(data)
      ? data
          .map((entry) => {
            if (!entry || typeof entry !== 'object') {
              return null;
            }
            const content = typeof entry.content === 'string' ? entry.content : null;
            if (!content) {
              return null;
            }
            return {
              content: content.replace(/\s+/g, ' ').trim().slice(0, 600),
              similarity: typeof entry.similarity === 'number' ? entry.similarity : 0,
              trustTier: typeof entry.trust_tier === 'string' ? (entry.trust_tier as 'T1' | 'T2' | 'T3' | 'T4') : 'T4',
              sourceType: typeof entry.source_type === 'string' ? entry.source_type : null,
              sourceId: typeof entry.source_id === 'string' ? entry.source_id : null,
              documentId: typeof entry.document_id === 'string' ? entry.document_id : null,
            };
          })
          .filter((value): value is {
            content: string;
            similarity: number;
            trustTier: 'T1' | 'T2' | 'T3' | 'T4';
            sourceType: string | null;
            sourceId: string | null;
            documentId: string | null;
          } => Boolean(value))
      : [];

    const caseSourceIds = normalized
      .filter((entry) => entry.sourceType?.toLowerCase().includes('case') || entry.sourceType?.toLowerCase().includes('juris'))
      .map((entry) => entry.sourceId)
      .filter((value): value is string => Boolean(value));

    const caseQuality: Map<string, { score: number; hardBlock: boolean }> = new Map();
    if (caseSourceIds.length > 0) {
      const { data: scoreRows, error: scoreError } = await supabase
        .from('case_scores')
        .select('source_id, score_overall, hard_block')
        .in('source_id', caseSourceIds)
        .eq('org_id', orgId)
        .order('computed_at', { ascending: false });
      if (scoreError) {
        console.warn('case_score_lookup_failed', scoreError.message);
      }
      if (Array.isArray(scoreRows)) {
        for (const row of scoreRows) {
          if (!row?.source_id) continue;
          if (!caseQuality.has(row.source_id)) {
            caseQuality.set(row.source_id, {
              score: typeof row.score_overall === 'number' ? row.score_overall : 0,
              hardBlock: Boolean(row.hard_block),
            });
          }
        }
      }
    }

    const localSourceIds = new Set<string>();
    for (const entry of normalized) {
      if (entry.sourceId) {
        localSourceIds.add(entry.sourceId);
      }
    }

    const sourceMetadata: Map<
      string,
      {
        url: string | null;
        title: string | null;
        publisher: string | null;
        trustTier?: string;
        eli?: string | null;
        ecli?: string | null;
        bindingLanguage?: string | null;
        residencyZone?: string | null;
        akomaArticleCount?: number;
      }
    > = new Map();
    if (localSourceIds.size > 0) {
      const { data: sourceRows, error: sourceError } = await supabase
        .from('sources')
        .select('id, source_url, title, publisher, trust_tier, eli, ecli, binding_lang, residency_zone, akoma_ntoso')
        .eq('org_id', orgId)
        .in('id', Array.from(localSourceIds));
      if (sourceError) {
        console.warn('source_metadata_lookup_failed', sourceError.message);
      }
      if (Array.isArray(sourceRows)) {
        for (const row of sourceRows) {
          if (!row?.id) continue;
          sourceMetadata.set(row.id, {
            url: typeof row.source_url === 'string' ? row.source_url : null,
            title: typeof row.title === 'string' ? row.title : null,
            publisher: typeof row.publisher === 'string' ? row.publisher : null,
            trustTier: typeof row.trust_tier === 'string' ? row.trust_tier : undefined,
            eli: typeof row.eli === 'string' ? row.eli : null,
            ecli: typeof row.ecli === 'string' ? row.ecli : null,
            bindingLanguage: typeof row.binding_lang === 'string' ? row.binding_lang : null,
            residencyZone: typeof row.residency_zone === 'string' ? row.residency_zone : null,
            akomaArticleCount: countAkomaArticles(row.akoma_ntoso),
          });
        }
      }
    }

    const localSnippets: HybridSnippet[] = normalized
      .map((entry) => {
        const baseWeight = CASE_TRUST_WEIGHTS[entry.trustTier] ?? CASE_TRUST_WEIGHTS.T4;
        let weight = baseWeight;
        let blocked = false;

        if (entry.sourceType && entry.sourceType.toLowerCase().includes('case') && entry.sourceId) {
          const quality = caseQuality.get(entry.sourceId);
          if (quality?.hardBlock) {
            blocked = true;
          } else if (quality) {
            const normalizedScore = Math.max(0.1, quality.score / 100);
            weight *= normalizedScore;
            if (quality.score < 60) {
              weight *= 0.4;
            }
          } else {
            weight *= 0.6;
          }
        }

        if (blocked || entry.similarity <= 0.1 || weight <= 0) {
          return null;
        }

        const metadata = entry.sourceId ? sourceMetadata.get(entry.sourceId) : null;

        return {
          content: entry.content,
          similarity: entry.similarity,
          weight,
          origin: 'local' as const,
          sourceId: entry.sourceId,
          documentId: entry.documentId,
          url: metadata?.url ?? null,
          title: metadata?.title ?? null,
          publisher: metadata?.publisher ?? null,
          trustTier: entry.trustTier,
          eli: metadata?.eli ?? null,
          ecli: metadata?.ecli ?? null,
          bindingLanguage: metadata?.bindingLanguage ?? null,
          residencyZone: metadata?.residencyZone ?? null,
          akomaArticleCount: metadata?.akomaArticleCount ?? null,
        } satisfies HybridSnippet | null;
      })
      .filter((value): value is HybridSnippet => Boolean(value));

    const fileSearchRaw = await queryFileSearchResults(question, 6);
    const fileIds = fileSearchRaw.map((item) => item.fileId).filter((value): value is string => Boolean(value));

    const fileMetadata: Map<
      string,
      {
        documentId: string | null;
        sourceId: string | null;
        url: string | null;
        title: string | null;
        publisher: string | null;
        trustTier?: string;
        eli?: string | null;
        ecli?: string | null;
        bindingLanguage?: string | null;
        residencyZone?: string | null;
        akomaArticleCount?: number;
      }
    > = new Map();
    if (fileIds.length > 0) {
      const { data: documentRows, error: docError } = await supabase
        .from('documents')
        .select(
          'id, source_id, openai_file_id, name, storage_path, sources(id, title, source_url, publisher, trust_tier, eli, ecli, binding_lang, residency_zone, akoma_ntoso)',
        )
        .eq('org_id', orgId)
        .in('openai_file_id', fileIds);
      if (docError) {
        console.warn('document_metadata_lookup_failed', docError.message);
      }
      if (Array.isArray(documentRows)) {
        for (const doc of documentRows) {
          if (!doc?.openai_file_id) continue;
          const source = (doc as Record<string, unknown>).sources as
            | (Record<string, unknown> & { id?: string; title?: string; source_url?: string; publisher?: string; trust_tier?: string })
            | null
            | undefined;
          fileMetadata.set(doc.openai_file_id, {
            documentId: typeof doc.id === 'string' ? doc.id : null,
            sourceId: typeof doc.source_id === 'string' ? doc.source_id : (source?.id as string | undefined) ?? null,
            url:
              (typeof source?.source_url === 'string' ? source.source_url : null) ??
              (typeof doc.storage_path === 'string' ? doc.storage_path : null),
            title: typeof source?.title === 'string' ? source.title : typeof doc.name === 'string' ? doc.name : null,
            publisher: typeof source?.publisher === 'string' ? source.publisher : null,
            trustTier: typeof source?.trust_tier === 'string' ? source.trust_tier : undefined,
            eli: typeof source?.eli === 'string' ? source.eli : null,
            ecli: typeof source?.ecli === 'string' ? source.ecli : null,
            bindingLanguage: typeof source?.binding_lang === 'string' ? source.binding_lang : null,
            residencyZone: typeof source?.residency_zone === 'string' ? source.residency_zone : null,
            akomaArticleCount: countAkomaArticles(source?.akoma_ntoso),
          });
        }
      }
    }

    const fileSnippets: HybridSnippet[] = fileSearchRaw.map((result) => {
      const metadata = result.fileId ? fileMetadata.get(result.fileId) : null;
      const trustTier = (metadata?.trustTier as 'T1' | 'T2' | 'T3' | 'T4' | undefined) ?? 'T2';
      const baseWeight = CASE_TRUST_WEIGHTS[trustTier] ?? CASE_TRUST_WEIGHTS.T2;
      const similarity = typeof result.score === 'number' && Number.isFinite(result.score) ? result.score : 0.5;
      const normalizedWeight = baseWeight * Math.max(similarity, 0.2);
      return {
        content: result.content,
        similarity,
        weight: normalizedWeight,
        origin: 'file_search' as const,
        sourceId: metadata?.sourceId ?? null,
        documentId: metadata?.documentId ?? null,
        fileId: result.fileId,
        url: metadata?.url ?? null,
        title: metadata?.title ?? null,
        publisher: metadata?.publisher ?? null,
        trustTier,
        eli: metadata?.eli ?? null,
        ecli: metadata?.ecli ?? null,
        bindingLanguage: metadata?.bindingLanguage ?? null,
        residencyZone: metadata?.residencyZone ?? null,
        akomaArticleCount: metadata?.akomaArticleCount ?? null,
      } satisfies HybridSnippet;
    });

    const combined = [...localSnippets, ...fileSnippets]
      .filter((snippet) => snippet.content.length > 0)
      .sort((a, b) => b.similarity * b.weight - a.similarity * a.weight)
      .slice(0, 8);

    return combined;
  } catch (error) {
    console.warn('hybrid_context_failed', error);
    return [];
  }
}

export async function getHybridRetrievalContext(
  orgId: string,
  question: string,
  jurisdiction: string | null,
): Promise<HybridSnippet[]> {
  return fetchHybridSnippets(orgId, question, jurisdiction, new Map());
}

function summariseSnippets(snippets: HybridSnippet[]): string {
  if (snippets.length === 0) {
    return '';
  }

  return snippets
    .slice(0, 5)
    .map((snippet, index) => {
      const label = snippet.origin === 'file_search' ? 'vector store' : 'local';
      return `#${index + 1} [${label}] ${snippet.content}`;
    })
    .join('\n\n');
}

function verifyAgentPayload(
  payload: IRACPayload,
  options: { allowlistViolations: string[]; initialRouting: RoutingResult },
): VerificationResult {
  if (options.allowlistViolations.length > 0) {
    const domains = options.allowlistViolations.map((url) => {
      try {
        return new URL(url).hostname;
      } catch (error) {
        return url;
      }
    });
    const unique = Array.from(new Set(domains));
    throw new Error(
      `Citations hors périmètre autorisé (${unique.join(', ')}). Relancer avec site:<domaine_officiel> ou escalader HITL.`,
    );
  }

  const notes: VerificationNote[] = [];
  let status: VerificationStatus =
    payload.risk.hitl_required || payload.risk.level === 'HIGH' ? 'hitl_escalated' : 'passed';

  const escalate = (note: VerificationNote) => {
    notes.push(note);
    if (note.severity !== 'info') {
      status = 'hitl_escalated';
      payload.risk.hitl_required = true;
      if (note.severity === 'critical') {
        payload.risk.level = 'HIGH';
      } else if (payload.risk.level === 'LOW') {
        payload.risk.level = 'MEDIUM';
      }
    }
  };

  const trimmedIssue = payload.issue?.trim() ?? '';
  if (trimmedIssue.length === 0) {
    escalate({
      code: 'missing_issue',
      message: "Section « Issue » absente : revue humaine recommandée.",
      severity: 'warning',
    });
  }

  if (!payload.rules || payload.rules.length === 0) {
    escalate({
      code: 'missing_rules',
      message: "Bloc « Règles » vide : escalade HITL obligatoire pour validation juridique.",
      severity: 'critical',
    });
  }

  if (!payload.application || payload.application.trim().length === 0) {
    escalate({
      code: 'missing_application',
      message: "Section « Application » vide : nécessite une revue humaine.",
      severity: 'warning',
    });
  }

  if (!payload.conclusion || payload.conclusion.trim().length === 0) {
    escalate({
      code: 'missing_conclusion',
      message: "Section « Conclusion » vide : confirmer la position juridique via HITL.",
      severity: 'warning',
    });
  }

  if (!payload.citations || payload.citations.length === 0) {
    escalate({
      code: 'missing_citations',
      message: 'Aucune citation officielle fournie : escalade HITL pour vérification et indexation.',
      severity: 'critical',
    });
  } else {
    const officialCitations = payload.citations.filter((citation) => isUrlAllowlisted(citation.url));
    if (officialCitations.length === 0) {
      escalate({
        code: 'no_allowlisted_citation',
        message: 'Les citations renvoient à des domaines secondaires : contrôler et relancer avec sources officielles.',
        severity: 'critical',
      });
    }
  }

  if (payload.rules && payload.rules.length > 0) {
    const bindingCount = payload.rules.filter((rule) => rule.binding).length;
    if (bindingCount === 0) {
      escalate({
        code: 'non_binding_rules',
        message:
          'Les références fournies ne sont pas marquées comme contraignantes : confirmer la source officielle avant diffusion.',
        severity: 'warning',
      });
    }
  }

  if (!options.initialRouting.primary) {
    escalate({
      code: 'ambiguous_jurisdiction',
      message: 'Juridiction non confirmée : la validation humaine doit confirmer le périmètre applicable.',
      severity: 'warning',
    });
  }

  return { status, notes, allowlistViolations: options.allowlistViolations };
}

function buildLearningJobs(
  payload: IRACPayload,
  initialRouting: RoutingResult,
  input: AgentRunInput,
): Array<{ type: string; payload: unknown }> {
  const learningJobs: Array<{ type: string; payload: unknown }> = [];

  if (payload.citations.length === 0) {
    learningJobs.push({
      type: 'indexing_ticket',
      payload: {
        question: input.question,
        orgId: input.orgId,
        routing: initialRouting,
        note: 'Aucune citation fournie par le modèle malgré la réussite de la requête.',
      },
    });
  }

  if (!payload.rules || payload.rules.length === 0) {
    learningJobs.push({
      type: 'guardrail_tune_ticket',
      payload: {
        question: input.question,
        orgId: input.orgId,
        reason: 'Le bloc Règles est vide; vérifier la prompt policy et l’utilisation des outils.',
      },
    });
  }

  if (!initialRouting.primary) {
    learningJobs.push({
      type: 'query_rewrite_ticket',
      payload: {
        question: input.question,
        context: input.context,
        detectedCandidates: initialRouting.candidates,
      },
    });
  }

  return learningJobs;
}

function applyComplianceGates(
  payload: IRACPayload,
  initialRouting: RoutingResult,
  input: AgentRunInput,
  baseJobs: Array<{ type: string; payload: unknown }>,
  complianceContext?: ComplianceContext | null,
): {
  learningJobs: Array<{ type: string; payload: unknown }>;
  events: ComplianceEventRecord[];
  assessment: ComplianceAssessment;
} {
  const compliance = evaluateCompliance({
    question: input.question,
    payload,
    primaryJurisdiction: initialRouting.primary ?? null,
    disclosures: complianceContext ?? null,
  });

  const jobs = [...baseJobs];
  const events: ComplianceEventRecord[] = [];

  if (compliance.fria.required) {
    if (!payload.risk.hitl_required) {
      payload.risk.hitl_required = true;
    }
    if (payload.risk.level === 'LOW') {
      payload.risk.level = 'MEDIUM';
    }

    jobs.push({
      type: 'compliance_fria_ticket',
      payload: {
        question: input.question,
        jurisdiction: payload.jurisdiction.country,
        reasons: compliance.fria.reasons,
      },
    });

    events.push({
      kind: 'compliance.eu_ai_act.fria_required',
      metadata: {
        jurisdiction: payload.jurisdiction.country,
        reasons: compliance.fria.reasons,
      },
    });
  }

  if (compliance.cepej.violations.length > 0) {
    jobs.push({
      type: 'guardrail_cepej_ticket',
      payload: {
        question: input.question,
        jurisdiction: payload.jurisdiction.country,
        violations: compliance.cepej.violations,
      },
    });

    events.push({
      kind: 'compliance.cepej.violation',
      metadata: {
        jurisdiction: payload.jurisdiction.country,
        violations: compliance.cepej.violations,
      },
    });
  }

  if (!compliance.statute.passed) {
    if (!payload.risk.hitl_required) {
      payload.risk.hitl_required = true;
    }
    if (payload.risk.level === 'LOW') {
      payload.risk.level = 'MEDIUM';
    }
    const reasons = compliance.statute.violations;
    const message = reasons.join(', ');
    if (message.length > 0 && !payload.risk.why.toLowerCase().includes(message.toLowerCase())) {
      payload.risk.why = payload.risk.why.length > 0 ? `${payload.risk.why} | ${message}` : message;
    }
    jobs.push({
      type: 'statute_alignment_ticket',
      payload: {
        question: input.question,
        jurisdiction: payload.jurisdiction.country,
        violations: reasons,
      },
    });
    events.push({
      kind: 'compliance.statute_alignment.failed',
      metadata: {
        jurisdiction: payload.jurisdiction.country,
        violations: reasons,
      },
    });
  }

  if (!compliance.disclosures.consentSatisfied || !compliance.disclosures.councilSatisfied) {
    if (!payload.risk.hitl_required) {
      payload.risk.hitl_required = true;
    }
    if (payload.risk.level === 'LOW') {
      payload.risk.level = 'MEDIUM';
    }
    const missing = compliance.disclosures.missing;
    if (missing.length > 0) {
      const detail = `disclosures:${missing.join(',')}`;
      if (!payload.risk.why.toLowerCase().includes(detail.toLowerCase())) {
        payload.risk.why = payload.risk.why.length > 0 ? `${payload.risk.why} | ${detail}` : detail;
      }
    }
    jobs.push({
      type: 'disclosure_followup_ticket',
      payload: {
        question: input.question,
        jurisdiction: payload.jurisdiction.country,
        missing: missing,
      },
    });
    events.push({
      kind: 'compliance.disclosure.missing',
      metadata: {
        jurisdiction: payload.jurisdiction.country,
        missing,
      },
    });
    const provenance = ensureProvenance(payload);
    provenance.disclosures.satisfied = false;
  }

  return { learningJobs: jobs, events, assessment: compliance };
}

function applyBindingLanguageNotices(
  payload: IRACPayload,
  routing: RoutingResult,
): (BindingLanguageInfo & { rationale: string }) | null {
  const primary = payload.jurisdiction.country ?? routing.primary?.country ?? null;
  const firstCitationUrl = payload.citations.find((citation) => Boolean(citation.url))?.url;
  const fallbackRuleUrl = payload.rules.find((rule) => Boolean(rule.source_url))?.source_url;
  const bindingInfo = determineBindingLanguage(primary, firstCitationUrl ?? fallbackRuleUrl);

  if (!bindingInfo) {
    return null;
  }

  const notice = bindingInfo.translationNotice ?? '';
  if (notice.length > 0) {
    const normalized = notice.toLowerCase();
    let noteInjected = false;
    payload.citations = payload.citations.map((citation, index) => {
      const currentNote = citation.note ?? '';
      if (currentNote.toLowerCase().includes(normalized)) {
        noteInjected = true;
        return citation;
      }
      if (!noteInjected && index === 0) {
        noteInjected = true;
        return {
          ...citation,
          note: currentNote.length > 0 ? `${currentNote} ${notice}` : notice,
        };
      }
      return citation;
    });

    if (!noteInjected && payload.citations.length > 0) {
      payload.citations = [
        {
          ...payload.citations[0],
          note:
            payload.citations[0].note && payload.citations[0].note.length > 0
              ? `${payload.citations[0].note} ${notice}`
              : notice,
        },
        ...payload.citations.slice(1),
      ];
    }

    if (!payload.risk.why.toLowerCase().includes(normalized)) {
      payload.risk.why = payload.risk.why.length > 0 ? `${payload.risk.why} | ${notice}` : notice;
    }
  }

  if (bindingInfo.requiresBanner) {
    if (!payload.risk.hitl_required) {
      payload.risk.hitl_required = true;
    }
    if (payload.risk.level === 'LOW') {
      payload.risk.level = 'MEDIUM';
    }
    if (!payload.risk.why.toLowerCase().includes(bindingInfo.source.toLowerCase())) {
      payload.risk.why = payload.risk.why.length > 0
        ? `${payload.risk.why} | ${bindingInfo.source}`
        : bindingInfo.source;
    }
  }

  return bindingInfo;
}

function buildStubPayload(
  question: string,
  initialRouting: RoutingResult,
  hybridSnippets: HybridSnippet[],
): IRACPayload {
  const normalized = question.toLowerCase();
  const hybridSummary = summariseSnippets(hybridSnippets);
  const contextSection = hybridSummary.length > 0 ? `\n\nSynthèse des extraits RAG:\n${hybridSummary}` : '';

  if (normalized.includes('maroc') || normalized.includes('non-concurrence')) {
    return {
      jurisdiction: { country: 'MA', eu: false, ohada: false },
      issue: 'Validité d’une clause de non-concurrence au Maroc dans un contrat de travail.',
      rules: [
        {
          citation: 'Code du travail marocain, art. 24',
          source_url: 'https://www.sgg.gov.ma/Portals/0/BO/2024/bo_7244_fr.pdf',
          binding: false,
          effective_date: '2024-03-01',
        },
        {
          citation: 'Bulletin officiel du Royaume du Maroc – édition de traduction officielle',
          source_url: 'https://www.sgg.gov.ma/Portals/0/BO/2024/bo_7244_fr.pdf',
          binding: false,
          effective_date: '2024-03-01',
        },
      ],
      application:
        'La clause est licite si elle protège un intérêt légitime, reste limitée dans le temps et l’espace et prévoit une contrepartie financière proportionnée. La version arabe du Bulletin officiel fait foi; la traduction française doit être rapprochée du texte contraignant.' +
        contextSection,
      conclusion:
        'La clause de non-concurrence est valable sous réserve d’un intérêt légitime démontré, d’une limitation raisonnable et d’une indemnisation adéquate, avec revue HITL pour confirmer la version arabe.',
      citations: [
        {
          title: 'Bulletin officiel – traduction officielle',
          court_or_publisher: 'Secrétariat Général du Gouvernement du Maroc',
          date: '2024-03-01',
          url: 'https://www.sgg.gov.ma/Portals/0/BO/2024/bo_7244_fr.pdf',
          note: 'Traduction officielle; vérifier l’édition arabe pour force obligatoire.',
        },
      ],
      risk: {
        level: 'MEDIUM',
        why: 'Traduction non contraignante – validation HITL requise pour confirmer la version arabe.',
        hitl_required: true,
      },
      provenance: createEmptyProvenance(),
    } satisfies IRACPayload;
  }

  if (normalized.includes('ohada') || normalized.includes('gage') || normalized.includes('sûret')) {
    return {
      jurisdiction: { country: 'OHADA', eu: false, ohada: true },
      issue: 'Constitution d’un gage sans dépossession sur des stocks dans l’espace OHADA.',
      rules: [
        {
          citation: 'Acte uniforme portant organisation des sûretés, art. 233 à 242',
          source_url: 'https://www.ohada.org/index.php/fr/actes-uniformes/128-aus',
          binding: true,
          effective_date: '2011-05-16',
        },
        {
          citation: 'Jurisprudence CCJA confirmant la publicité obligatoire du gage sans dépossession',
          source_url: 'https://www.ohada.org/index.php/fr/jurisprudence/ccja',
          binding: true,
          effective_date: '2019-06-27',
        },
      ],
      application:
        'Le gage doit être constaté par écrit, publié au RCCM et prévoir une description précise des stocks. La CCJA rappelle que la publicité est déterminante pour opposabilité aux tiers.' +
        contextSection,
      conclusion:
        'Le gage sans dépossession est valable dès lors que le créancier procède à la publicité RCCM et maintient une description dynamique des stocks, avec suivi HITL si une particularité locale est identifiée.',
      citations: [
        {
          title: 'Acte uniforme sur les sûretés',
          court_or_publisher: 'OHADA',
          date: '2011-05-16',
          url: 'https://www.ohada.org/index.php/fr/actes-uniformes/128-aus',
          note: 'Acte uniforme – version 2010 en vigueur.',
        },
        {
          title: 'Décision CCJA – gage sans dépossession',
          court_or_publisher: 'Cour Commune de Justice et d’Arbitrage',
          date: '2019-06-27',
          url: 'https://www.ohada.org/index.php/fr/jurisprudence/ccja',
          note: 'Jurisprudence confirmant la publicité au RCCM.',
        },
      ],
      risk: {
        level: 'LOW',
        why: 'Acte uniforme et jurisprudence CCJA directement applicables.',
        hitl_required: false,
      },
      provenance: createEmptyProvenance(),
    } satisfies IRACPayload;
  }

  const routing = initialRouting.primary ?? {
    country: 'FR',
    eu: true,
    ohada: false,
    confidence: 0.2,
    rationale: 'fallback',
  };

  return {
    jurisdiction: { country: routing.country, eu: routing.eu, ohada: routing.ohada },
    issue: 'Responsabilité délictuelle d’un salarié ayant causé un dommage en France.',
    rules: [
      {
        citation: 'Code civil (FR), art. 1240',
        source_url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902',
        binding: true,
        effective_date: '2016-10-01',
      },
      {
        citation: 'Cour de cassation, chambre sociale, 25 novembre 2015, n° 14-21.125',
        source_url: 'https://www.courdecassation.fr/decision/58fc23dd302bf94d3f8b45c6',
        binding: true,
        effective_date: '2015-11-25',
      },
    ],
    application:
      'La responsabilité délictuelle suppose une faute du salarié, un dommage et un lien de causalité direct. L’employeur peut engager l’action contre le salarié fautif ou rechercher la responsabilité de l’employeur sur le terrain du commettant.' +
      contextSection,
    conclusion:
      'Les critères de l’article 1240 du Code civil sont réunis lorsque la faute personnelle du salarié est caractérisée; une revue HITL est recommandée si une faute pénale est alléguée.',
    citations: [
      {
        title: 'Code civil – article 1240',
        court_or_publisher: 'Légifrance',
        date: '2016-10-01',
        url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417902',
        note: 'Texte consolidé',
      },
      {
        title: 'Cass. soc., 25 novembre 2015, n° 14-21.125',
        court_or_publisher: 'Cour de cassation',
        date: '2015-11-25',
        url: 'https://www.courdecassation.fr/decision/58fc23dd302bf94d3f8b45c6',
        note: 'Arrêt intégral',
      },
    ],
    risk: {
      level: 'LOW',
      why: 'Analyse jurisprudentielle classique en droit français.',
      hitl_required: false,
    },
    provenance: createEmptyProvenance(),
  } satisfies IRACPayload;
}

async function computeCaseQuality(
  orgId: string,
  jurisdiction: string | null,
  citations: IRACPayload['citations'],
): Promise<{
  summaries: CaseQualitySummary[];
  forceHitl: boolean;
  statuteAlignments: StatuteAlignmentDetail[];
  treatmentGraph: CaseTreatmentGraphNode[];
  riskFlags: CaseRiskFlag[];
}> {
  if (!citations || citations.length === 0) {
    return { summaries: [], forceHitl: false, statuteAlignments: [], treatmentGraph: [], riskFlags: [] };
  }

  const urls = citations.map((citation) => citation.url).filter((url): url is string => typeof url === 'string' && url.length > 0);
  if (urls.length === 0) {
    return { summaries: [], forceHitl: false, statuteAlignments: [], treatmentGraph: [], riskFlags: [] };
  }

  const { data: sourceRows, error: sourceError } = await supabase
    .from('sources')
    .select(
      'id, source_url, source_type, jurisdiction_code, trust_tier, binding_lang, effective_date, created_at, political_risk_flag, court_rank, court_identifier',
    )
    .eq('org_id', orgId)
    .in('source_url', urls);

  if (sourceError) {
    console.warn('case_quality_source_lookup_failed', sourceError.message);
    return { summaries: [], forceHitl: false, statuteAlignments: [], treatmentGraph: [], riskFlags: [] };
  }

  const caseSources = (sourceRows ?? []).filter((row) => {
    const type = (row?.source_type ?? '').toLowerCase();
    return type.includes('case') || type.includes('juris');
  });

  if (caseSources.length === 0) {
    return { summaries: [], forceHitl: false, statuteAlignments: [], treatmentGraph: [], riskFlags: [] };
  }

  const caseIds = caseSources.map((row) => row.id).filter((value): value is string => Boolean(value));

  const [treatmentResult, alignmentResult, overrideResult, existingScoreResult, riskResult] = await Promise.all([
    supabase
      .from('case_treatments')
      .select('source_id, treatment, weight, decided_at')
      .in('source_id', caseIds)
      .eq('org_id', orgId),
    supabase
      .from('case_statute_links')
      .select('case_source_id, statute_url, article, alignment_score, rationale_json')
      .in('case_source_id', caseIds)
      .eq('org_id', orgId),
    supabase
      .from('case_score_overrides')
      .select('source_id, new_score, reason')
      .in('source_id', caseIds)
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('case_scores')
      .select('source_id, version, hard_block, score_overall')
      .in('source_id', caseIds)
      .eq('org_id', orgId)
      .order('computed_at', { ascending: false }),
    supabase
      .from('risk_register')
      .select('juris_code, court_identifier, risk_flag, note, period_from, period_to')
      .in(
        'juris_code',
        caseSources
          .map((row) => row.jurisdiction_code)
          .filter((value): value is string => typeof value === 'string' && value.length > 0),
      )
      .or(`org_id.eq.${orgId},org_id.is.null`),
  ]);

  if (treatmentResult.error) {
    console.warn('case_treatments_lookup_failed', treatmentResult.error.message);
  }
  if (alignmentResult.error) {
    console.warn('case_statute_links_lookup_failed', alignmentResult.error.message);
  }
  if (overrideResult.error) {
    console.warn('case_score_override_lookup_failed', overrideResult.error.message);
  }
  if (existingScoreResult.error) {
    console.warn('case_score_version_lookup_failed', existingScoreResult.error.message);
  }
  if (riskResult.error) {
    console.warn('risk_register_lookup_failed', riskResult.error.message);
  }

  const treatmentsBySource = new Map<string, { treatment: string; weight?: number | null; decidedAt?: string | null }[]>();
  for (const entry of treatmentResult.data ?? []) {
    if (!entry?.source_id) continue;
    const list = treatmentsBySource.get(entry.source_id) ?? [];
    list.push({ treatment: entry.treatment, weight: entry.weight, decidedAt: entry.decided_at });
    treatmentsBySource.set(entry.source_id, list);
  }

  const alignmentsBySource = new Map<string, { alignmentScore?: number | null }[]>();
  const alignmentDetailBySource = new Map<string, CaseStatuteSnippet[]>();

  function extractRationaleSnippet(input: unknown): string | null {
    if (!input || typeof input !== 'object') {
      return null;
    }
    if ('snippet' in (input as Record<string, unknown>)) {
      const snippet = (input as { snippet?: unknown }).snippet;
      if (typeof snippet === 'string') {
        return snippet;
      }
    }
    if ('highlights' in (input as Record<string, unknown>)) {
      const highlights = (input as { highlights?: unknown }).highlights;
      if (Array.isArray(highlights)) {
        const first = highlights.find((entry) => typeof entry === 'string');
        if (typeof first === 'string') {
          return first;
        }
      }
    }
    if ('text' in (input as Record<string, unknown>)) {
      const text = (input as { text?: unknown }).text;
      if (typeof text === 'string') {
        return text;
      }
    }
    return null;
  }
  for (const entry of alignmentResult.data ?? []) {
    if (!entry?.case_source_id) continue;
    const scoreList = alignmentsBySource.get(entry.case_source_id) ?? [];
    scoreList.push({ alignmentScore: entry.alignment_score });
    alignmentsBySource.set(entry.case_source_id, scoreList);

    const detailList = alignmentDetailBySource.get(entry.case_source_id) ?? [];
    const statuteValue = (entry as { statute_url?: unknown }).statute_url;
    detailList.push({
      statuteUrl: typeof statuteValue === 'string' ? statuteValue : null,
      article: (entry as { article?: string | null }).article ?? null,
      alignmentScore: typeof entry.alignment_score === 'number' ? entry.alignment_score : null,
      rationale: extractRationaleSnippet((entry as { rationale_json?: unknown }).rationale_json ?? null),
    });
    alignmentDetailBySource.set(entry.case_source_id, detailList);
  }

  const overridesBySource = new Map<string, { score: number; reason?: string | null }>();
  for (const entry of overrideResult.data ?? []) {
    if (!entry?.source_id || typeof entry.new_score !== 'number') continue;
    if (!overridesBySource.has(entry.source_id)) {
      overridesBySource.set(entry.source_id, { score: entry.new_score, reason: entry.reason });
    }
  }

  const latestVersionBySource = new Map<string, number>();
  const persistedHardBlockBySource = new Map<string, boolean>();
  const persistedScoreBySource = new Map<string, number | null>();
  for (const entry of existingScoreResult.data ?? []) {
    if (!entry?.source_id) continue;
    if (!latestVersionBySource.has(entry.source_id)) {
      latestVersionBySource.set(entry.source_id, typeof entry.version === 'number' ? entry.version : 1);
    }
    if (!persistedHardBlockBySource.has(entry.source_id)) {
      persistedHardBlockBySource.set(entry.source_id, Boolean((entry as { hard_block?: boolean }).hard_block));
    }
    if (!persistedScoreBySource.has(entry.source_id)) {
      const rawScore = (entry as { score_overall?: number }).score_overall;
      persistedScoreBySource.set(entry.source_id, typeof rawScore === 'number' ? rawScore : null);
    }
  }

  const riskOverlaysByJurisdiction = new Map<string, { flag: string; court?: string | null; from?: string | null; to?: string | null; note?: string | null }[]>();
  for (const entry of riskResult.data ?? []) {
    if (!entry?.juris_code) continue;
    const list = riskOverlaysByJurisdiction.get(entry.juris_code) ?? [];
    list.push({
      flag: entry.risk_flag,
      court: entry.court_identifier,
      from: entry.period_from,
      to: entry.period_to,
      note: entry.note,
    });
    riskOverlaysByJurisdiction.set(entry.juris_code, list);
  }

  const summaries: CaseQualitySummary[] = [];
  const statuteAlignmentDetails: StatuteAlignmentDetail[] = [];
  const treatmentGraph: CaseTreatmentGraphNode[] = [];
  const riskFlagDetails: CaseRiskFlag[] = [];
  let forceHitl = false;
  const now = new Date();

  for (const source of caseSources) {
    if (!source?.id || typeof source.source_url !== 'string') {
      continue;
    }

    const riskCandidates = (riskOverlaysByJurisdiction.get(source.jurisdiction_code ?? '') ?? []).filter((risk) => {
      if (risk.court && source.court_identifier && risk.court !== source.court_identifier) {
        return false;
      }
      if (risk.from && new Date(risk.from) > now) {
        return false;
      }
      if (risk.to && new Date(risk.to) < now) {
        return false;
      }
      return true;
    });

    const override = overridesBySource.get(source.id);

    const statuteSignals = alignmentsBySource.get(source.id) ?? [];
    const result = evaluateCaseQuality({
      trustTier: (source.trust_tier as 'T1' | 'T2' | 'T3' | 'T4') ?? 'T4',
      courtRank: source.court_rank ?? null,
      jurisdiction: source.jurisdiction_code ?? 'FR',
      bindingJurisdiction: jurisdiction ?? source.jurisdiction_code ?? 'FR',
      politicalRiskFlag: Boolean(source.political_risk_flag),
      bindingLanguage: source.binding_lang ?? null,
      effectiveDate: source.effective_date ?? null,
      createdAt: source.created_at ?? null,
      treatments: treatmentsBySource.get(source.id) ?? [],
      statuteAlignments: statuteSignals,
      riskOverlays: riskCandidates.map((risk) => ({ flag: risk.flag, note: risk.note })),
      override: override ?? null,
    });

    const details = alignmentDetailBySource.get(source.id) ?? [];
    const caseUrl = source.source_url;
    const statuteSnippets: CaseStatuteSnippet[] = details.map((detail) => ({
      caseUrl,
      statuteUrl: detail.statuteUrl,
      article: detail.article ?? null,
      alignmentScore: typeof detail.alignmentScore === 'number' ? detail.alignmentScore : null,
      rationale: detail.rationale ?? null,
    }));

    for (const detail of statuteSnippets) {
      if (!detail.statuteUrl) {
        continue;
      }
      statuteAlignmentDetails.push({
        caseUrl: detail.caseUrl,
        statuteUrl: detail.statuteUrl,
        article: detail.article,
        alignmentScore: detail.alignmentScore,
      });
    }

    const persistedHardBlock = persistedHardBlockBySource.get(source.id) ?? false;
    const combinedHardBlock = result.hardBlock || persistedHardBlock;
    const persistedScore = persistedScoreBySource.get(source.id);
    const summaryScore = Number.isFinite(result.score) ? result.score : persistedScore ?? result.score;

    const treatmentsForSource = treatmentsBySource.get(source.id) ?? [];
    for (const treatment of treatmentsForSource) {
      treatmentGraph.push({
        caseUrl,
        treatment: treatment.treatment,
        decidedAt: treatment.decidedAt,
        weight: treatment.weight ?? null,
      });
    }

    for (const risk of riskCandidates) {
      riskFlagDetails.push({ caseUrl, flag: risk.flag, note: risk.note ?? null });
    }

    summaries.push({
      sourceId: source.id,
      url: caseUrl,
      score: summaryScore,
      hardBlock: combinedHardBlock,
      notes: persistedHardBlock && !result.hardBlock ? [...result.notes, 'hard_block_persisted'] : result.notes,
      axes: result.axes,
      treatments: treatmentsForSource,
      statuteAlignments: statuteSnippets,
      riskSignals: riskCandidates.map((risk) => ({ flag: risk.flag, note: risk.note ?? null })),
    });

    if (combinedHardBlock || (typeof summaryScore === 'number' && summaryScore < 55)) {
      forceHitl = true;
    }

    const nextVersion = (latestVersionBySource.get(source.id) ?? 0) + 1;
    const insertPayload = {
      org_id: orgId,
      source_id: source.id,
      juris_code: source.jurisdiction_code ?? 'FR',
      score_overall: result.score,
      axes: result.axes,
      hard_block: result.hardBlock,
      version: nextVersion,
      model_ref: 'case_quality_v1',
      notes: result.notes,
    };

    const { error: insertError } = await supabase.from('case_scores').insert(insertPayload);
    if (insertError) {
      console.warn('case_score_insert_failed', insertError.message);
    }
  }

  return {
    summaries,
    forceHitl,
    statuteAlignments: statuteAlignmentDetails,
    treatmentGraph,
    riskFlags: riskFlagDetails,
  };
}

async function computeCaseScoreForSource(
  orgId: string,
  sourceId: string,
): Promise<
  | {
      status: 'ok';
      sourceId: string;
      score: number | null;
      hardBlock: boolean;
      notes: string[];
      version: number | null;
    }
  | { status: 'not_found' }
> {
  const { data: source, error: sourceError } = await supabase
    .from('sources')
    .select('id, source_url, jurisdiction_code, title, publisher, effective_date')
    .eq('org_id', orgId)
    .eq('id', sourceId)
    .maybeSingle();

  if (sourceError) {
    throw new Error(sourceError.message);
  }
  if (!source || !source.source_url) {
    return { status: 'not_found' };
  }

  const jurisdiction = typeof source.jurisdiction_code === 'string' ? source.jurisdiction_code : null;

  await computeCaseQuality(orgId, jurisdiction, [
    {
      title: typeof source.title === 'string' ? source.title : source.source_url,
      court_or_publisher: typeof source.publisher === 'string' ? source.publisher : null,
      date: typeof source.effective_date === 'string' ? source.effective_date : null,
      url: source.source_url,
      note: 'manual_score',
    },
  ]);

  const { data: latestScore, error: scoreError } = await supabase
    .from('case_scores')
    .select('score_overall, hard_block, notes, version')
    .eq('org_id', orgId)
    .eq('source_id', sourceId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (scoreError) {
    throw new Error(scoreError.message);
  }

  if (!latestScore) {
    return {
      status: 'ok',
      sourceId,
      score: null,
      hardBlock: false,
      notes: [],
      version: null,
    };
  }

  const notes = Array.isArray(latestScore.notes)
    ? (latestScore.notes as unknown[])
        .map((entry) => (typeof entry === 'string' ? entry : null))
        .filter((entry): entry is string => Boolean(entry))
    : [];

  return {
    status: 'ok',
    sourceId,
    score: typeof latestScore.score_overall === 'number' ? latestScore.score_overall : null,
    hardBlock: Boolean((latestScore as { hard_block?: boolean }).hard_block),
    notes,
    version: typeof latestScore.version === 'number' ? latestScore.version : null,
  };
}

async function handleGuardrailFailure(
  error: unknown,
  planner: PlannerOutcome,
  input: AgentRunInput,
  toolLogs: ToolInvocationLog[],
  telemetryRecords: ToolTelemetry[],
  runKey: string,
  accessContext: OrgAccessContext | null,
): Promise<AgentRunResult | null> {
  const guardType = identifyGuardrail(error);
  if (!guardType) {
    return null;
  }

  const guardTime = new Date();
  const primary = planner.initialRouting.primary;
  const jurisdiction = {
    country: primary?.country ?? 'FR',
    eu: Boolean(primary?.eu ?? (primary?.country ? primary.country === 'FR' || primary.country === 'BE' || primary.country === 'LU' : true)),
    ohada: Boolean(primary?.ohada),
  };

  const firstSnippetUrl = planner.hybridSnippets.find((snippet) => typeof snippet.url === 'string')?.url ?? null;

  let issue = '';
  let application = '';
  let conclusion = '';
  let rules: Array<{ citation: string; source_url?: string | null; binding: boolean; effective_date?: string | null; note?: string | null }> = [];
  let citations: IRACPayload['citations'] = [];
  let guardReason = '';
  let verificationNote: VerificationNote;

  switch (guardType) {
    case 'binding-language': {
      const bindingInfo = determineBindingLanguage(jurisdiction.country, firstSnippetUrl ?? undefined);
      issue = 'Traduction officielle requise pour document à valeur juridique supérieure.';
      application = bindingInfo.translationNotice ??
        'La juridiction impose la consultation de la version originale avant toute analyse automatique.';
      conclusion =
        'La réponse est escaladée en revue humaine afin de confirmer la version juridiquement contraignante.';
      rules = [
        {
          citation: bindingInfo.source,
          source_url: firstSnippetUrl,
          binding: true,
          note: bindingInfo.translationNotice ?? undefined,
        },
      ];
      citations = firstSnippetUrl
        ? [
            {
              title: bindingInfo.source,
              court_or_publisher: null,
              date: null,
              url: firstSnippetUrl,
              note: bindingInfo.translationNotice ?? undefined,
            },
          ]
        : [];
      guardReason = bindingInfo.translationNotice ?? 'Langue contraignante détectée pour cette juridiction.';
      verificationNote = {
        code: 'binding_language_guardrail',
        message: guardReason,
        severity: 'critical',
      };
      break;
    }
    case 'structured-irac': {
      issue = 'IRAC incomplet détecté (sections manquantes).';
      application =
        'Le contrôleur de structure a identifié des sections IRAC incomplètes. Une validation humaine est nécessaire pour compléter l’analyse.';
      conclusion = 'Escalade en revue humaine pour compléter la structure IRAC avant diffusion.';
      rules = [
        {
          citation: 'Politique interne — Structure IRAC obligatoire',
          source_url: null,
          binding: true,
          note: 'Chaque réponse doit contenir Issue, Rules, Application et Conclusion.',
        },
      ];
      guardReason = 'Structure IRAC incomplète';
      verificationNote = {
        code: 'structured_irac_guardrail',
        message: 'Structure IRAC incomplète détectée, revue humaine requise.',
        severity: 'critical',
      };
      break;
    }
    case 'sensitive-topic': {
      issue = 'Requête classée à haut risque nécessitant validation humaine.';
      application =
        'Le score de risque élevé déclenche une revue HITL afin de documenter le FRIA et confirmer la réponse avant diffusion.';
      conclusion = 'Escalade HITL obligatoire pour traiter cette requête à haut risque.';
      rules = [
        {
          citation: 'EU AI Act – Articles 14 et 15 (systèmes à haut risque)',
          source_url: 'https://eur-lex.europa.eu/',
          binding: true,
        },
      ];
      guardReason = 'Niveau de risque élevé détecté';
      verificationNote = {
        code: 'sensitive_topic_hitl_guardrail',
        message: 'Risque élevé : revue humaine exigée.',
        severity: 'critical',
      };
      break;
    }
  }

  const payload: IRACPayload = {
    jurisdiction,
    issue,
    rules,
    application,
    conclusion,
    citations,
    risk: {
      level: 'HIGH',
      why: guardReason,
      hitl_required: true,
    },
    provenance: createEmptyProvenance(),
  };

  applyDisclosureProvenance(payload, accessContext ?? null);

  const verification: VerificationResult = {
    status: 'hitl_escalated',
    allowlistViolations: [],
    notes: [verificationNote],
  };

  toolLogs.push({
    name: 'guardrailEscalation',
    args: { guard: guardType, question: input.question },
    output: { escalated: true, reason: guardReason },
  });

  planner.planTrace.push({
    id: `guardrail_${guardType}`,
    name: 'Escalade guardrail',
    description: 'Sortie bloquée par une politique métier : passage en revue humaine.',
    startedAt: guardTime.toISOString(),
    finishedAt: guardTime.toISOString(),
    status: 'failed',
    attempts: 1,
    detail: { guardrail: guardType },
  });

  const baseLearningJobs = buildLearningJobs(payload, planner.initialRouting, input);
  const complianceContext = deriveComplianceContext(accessContext ?? null);
  const complianceOutcome = applyComplianceGates(
    payload,
    planner.initialRouting,
    input,
    baseLearningJobs,
    complianceContext,
  );
  const bindingBannerInfo = applyBindingLanguageNotices(payload, planner.initialRouting);
  if (bindingBannerInfo?.requiresBanner) {
    complianceOutcome.learningJobs.push({
      type: 'binding_language_banner',
      payload: {
        jurisdiction: bindingBannerInfo.jurisdiction,
        notice: bindingBannerInfo.translationNotice,
        source: bindingBannerInfo.source,
        question: input.question,
      },
    });
  }

  const notices = buildRunNotices(payload, {
    accessContext: accessContext ?? null,
    confidentialMode: planner.context.confidentialMode,
    initialRouting: planner.initialRouting,
  });

  const { runId, trust: trustPanel } = await persistRun(
    input,
    payload,
    toolLogs,
    planner.hybridSnippets,
    telemetryRecords,
    complianceOutcome.learningJobs,
    complianceOutcome.events,
    complianceOutcome.assessment,
    planner.planTrace,
    verification,
    planner.agentProfile,
    runKey,
    planner.context.confidentialMode,
    [],
  );

  await recordGoNoGoEvidenceForRun({
    orgId: input.orgId,
    actorId: input.userId,
    runId,
    compliance: complianceOutcome.assessment,
    bindingInfo: bindingBannerInfo,
    notices,
    confidentialMode: planner.context.confidentialMode,
    jurisdiction: payload.jurisdiction,
  });

  return {
    runId,
    payload,
    allowlistViolations: [],
    toolLogs,
    plan: planner.planTrace,
    notices,
    verification,
    trustPanel,
    compliance: complianceOutcome.assessment,
    agent: {
      key: planner.agentProfile.key,
      code: planner.agentProfile.manifestCode,
      label: planner.agentProfile.label,
      settings: planner.agentProfile.settings,
      tools: [...planner.agentProfile.allowedToolKeys],
    },
  };
}

function buildTrustPanel(
  payload: IRACPayload,
  retrievalSnippets: HybridSnippet[],
  caseQuality: {
    summaries: CaseQualitySummary[];
    forceHitl: boolean;
    statuteAlignments?: StatuteAlignmentDetail[];
    treatmentGraph?: CaseTreatmentGraphNode[];
    riskFlags?: CaseRiskFlag[];
  },
  verification: VerificationResult,
  compliance?: ComplianceAssessment | null,
): TrustPanelPayload {
  if (Array.isArray(caseQuality.statuteAlignments) && caseQuality.statuteAlignments.length > 0) {
    augmentProvenanceWithCaseAlignments(payload, caseQuality.statuteAlignments);
  }

  const toNullableString = (value: unknown): string | null =>
    typeof value === 'string' && value.length > 0 ? value : null;

  const provenanceDisclosures = payload.provenance?.disclosures ?? {
    consent: { required: null, acknowledged: null },
    council_of_europe: { required: null, acknowledged: null },
  };

  const requiredConsent =
    toNullableString(provenanceDisclosures?.consent?.required) ??
    (compliance?.disclosures.requiredConsentVersion ?? null);
  const acknowledgedConsent =
    toNullableString(provenanceDisclosures?.consent?.acknowledged) ??
    (compliance?.disclosures.acknowledgedConsentVersion ?? null);
  const requiredCoe =
    toNullableString(provenanceDisclosures?.council_of_europe?.required) ??
    (compliance?.disclosures.requiredCoeVersion ?? null);
  const acknowledgedCoe =
    toNullableString(provenanceDisclosures?.council_of_europe?.acknowledged) ??
    (compliance?.disclosures.acknowledgedCoeVersion ?? null);

  const consentSatisfied = !requiredConsent || acknowledgedConsent === requiredConsent;
  const councilSatisfied = !requiredCoe || acknowledgedCoe === requiredCoe;

  const baseCompliance: ComplianceAssessment = compliance
    ? {
        ...compliance,
        disclosures: {
          ...compliance.disclosures,
          requiredConsentVersion: compliance.disclosures.requiredConsentVersion ?? requiredConsent,
          acknowledgedConsentVersion:
            compliance.disclosures.acknowledgedConsentVersion ?? acknowledgedConsent,
          requiredCoeVersion: compliance.disclosures.requiredCoeVersion ?? requiredCoe,
          acknowledgedCoeVersion: compliance.disclosures.acknowledgedCoeVersion ?? acknowledgedCoe,
        },
      }
    : {
        fria: { required: false, reasons: [] },
        cepej: { passed: true, violations: [] },
        statute: { passed: true, violations: [] },
        disclosures: {
          consentSatisfied,
          councilSatisfied,
          missing: [],
          requiredConsentVersion: requiredConsent,
          acknowledgedConsentVersion: acknowledgedConsent,
          requiredCoeVersion: requiredCoe,
          acknowledgedCoeVersion: acknowledgedCoe,
        },
      } satisfies ComplianceAssessment;

  const disclosureMissing = new Set(baseCompliance.disclosures.missing);
  if (!consentSatisfied) {
    disclosureMissing.add('consent');
  }
  if (!councilSatisfied) {
    disclosureMissing.add('council_of_europe');
  }

  const complianceSummary: TrustPanelComplianceSummary = {
    ...baseCompliance,
    disclosures: {
      ...baseCompliance.disclosures,
      consentSatisfied,
      councilSatisfied,
      missing: Array.from(disclosureMissing),
      requiredConsentVersion: requiredConsent,
      acknowledgedConsentVersion: acknowledgedConsent,
      requiredCoeVersion: requiredCoe,
      acknowledgedCoeVersion: acknowledgedCoe,
    },
  };

  const citations = Array.isArray(payload.citations) ? payload.citations : [];
  let allowlistedCount = 0;
  const nonAllowlisted: Array<{ title: string; url: string }> = [];
  const translationWarnings = new Set<string>();
  const bindingNotes: Record<string, number> = {};

  for (const citation of citations) {
    const allowlisted = isUrlAllowlisted(citation.url);
    if (allowlisted) {
      allowlistedCount += 1;
    } else {
      nonAllowlisted.push({ title: citation.title, url: citation.url });
    }

    const note = (citation.note ?? '').trim();
    if (note.length > 0) {
      if (/traduction|translation|langue|language/i.test(note)) {
        translationWarnings.add(note);
      }
      bindingNotes[note] = (bindingNotes[note] ?? 0) + 1;
    }
  }

  const totalCitations = citations.length;
  const totalRules = Array.isArray(payload.rules) ? payload.rules.length : 0;
  const bindingRuleCount = Array.isArray(payload.rules)
    ? payload.rules.filter((rule) => rule.binding).length
    : 0;

  const snippetCount = retrievalSnippets.length;
  let fileSearchCount = 0;
  let localCount = 0;
  const hostCounts = new Map<string, number>();

  for (const snippet of retrievalSnippets) {
    if (snippet.origin === 'file_search') {
      fileSearchCount += 1;
    } else {
      localCount += 1;
    }

    if (snippet.url) {
      try {
        const host = new URL(snippet.url).hostname.toLowerCase();
        hostCounts.set(host, (hostCounts.get(host) ?? 0) + 1);
      } catch (_error) {
        // ignore malformed URL
      }
    }
  }

  const topHosts = Array.from(hostCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([host, count]) => ({ host, count }));

  const caseItems: TrustPanelCaseItem[] = caseQuality.summaries.map((summary) => ({
    url: summary.url,
    score: summary.score,
    hardBlock: summary.hardBlock,
    notes: summary.notes,
    axes: summary.axes,
  }));
  const minScore = caseItems.length > 0 ? Math.min(...caseItems.map((item) => item.score)) : null;
  const maxScore = caseItems.length > 0 ? Math.max(...caseItems.map((item) => item.score)) : null;

  const treatmentGraphNodes =
    Array.isArray(caseQuality.treatmentGraph) && caseQuality.treatmentGraph.length > 0
      ? caseQuality.treatmentGraph
      : caseQuality.summaries.flatMap((summary) =>
          (summary.treatments ?? []).map((treatment) => ({
            caseUrl: summary.url,
            treatment: treatment.treatment,
            decidedAt: treatment.decidedAt,
            weight: treatment.weight ?? null,
          } satisfies CaseTreatmentGraphNode)),
        );

  const statuteSnippetDetails: CaseStatuteSnippet[] =
    Array.isArray(caseQuality.statuteAlignments) && caseQuality.statuteAlignments.length > 0
      ? caseQuality.statuteAlignments.map((detail) => ({
          caseUrl: detail.caseUrl,
          statuteUrl: detail.statuteUrl,
          article: detail.article ?? null,
          alignmentScore: detail.alignmentScore ?? null,
          rationale: null,
        }))
      : caseQuality.summaries.flatMap((summary) => summary.statuteAlignments ?? []);

  const politicalFlagDetails =
    Array.isArray(caseQuality.riskFlags) && caseQuality.riskFlags.length > 0
      ? caseQuality.riskFlags
      : caseQuality.summaries.flatMap((summary) =>
          (summary.riskSignals ?? []).map((signal) => ({
            caseUrl: summary.url,
            flag: signal.flag,
            note: signal.note ?? null,
          } satisfies CaseRiskFlag)),
        );

  const provenanceBySource = new Map<
    string,
    {
      eli: string | null;
      ecli: string | null;
      bindingLanguage: string | null;
      residencyZone: string | null;
      akomaCount: number;
    }
  >();

  for (const snippet of retrievalSnippets) {
    if (!snippet.sourceId) {
      continue;
    }
    const existing = provenanceBySource.get(snippet.sourceId) ?? {
      eli: null,
      ecli: null,
      bindingLanguage: null,
      residencyZone: null,
      akomaCount: 0,
    };
    if (!existing.eli && snippet.eli) {
      existing.eli = snippet.eli;
    }
    if (!existing.ecli && snippet.ecli) {
      existing.ecli = snippet.ecli;
    }
    const bindingLanguage =
      typeof snippet.bindingLanguage === 'string' ? snippet.bindingLanguage.trim() : '';
    if (!existing.bindingLanguage && bindingLanguage) {
      existing.bindingLanguage = bindingLanguage;
    }
    const residencyZone =
      typeof snippet.residencyZone === 'string' ? snippet.residencyZone.trim() : '';
    if (!existing.residencyZone && residencyZone) {
      existing.residencyZone = residencyZone;
    }
    const articleCount = snippet.akomaArticleCount ?? 0;
    if (articleCount > existing.akomaCount) {
      existing.akomaCount = articleCount;
    }
    provenanceBySource.set(snippet.sourceId, existing);
  }

  const provenanceValues = Array.from(provenanceBySource.values());
  const totalSources = provenanceValues.length;
  const withEli = provenanceValues.filter((entry) => Boolean(entry.eli)).length;
  const withEcli = provenanceValues.filter((entry) => Boolean(entry.ecli)).length;
  const residencyCounter = new Map<string, number>();
  const bindingCounter = new Map<string, number>();
  let akomaArticles = 0;

  for (const entry of provenanceValues) {
    if (entry.residencyZone) {
      const trimmedZone = entry.residencyZone.trim();
      if (trimmedZone.length > 0) {
        const zoneKey = trimmedZone.toLowerCase();
        residencyCounter.set(zoneKey, (residencyCounter.get(zoneKey) ?? 0) + 1);
      }
    }
    if (entry.bindingLanguage) {
      const trimmedLanguage = entry.bindingLanguage.trim();
      if (trimmedLanguage.length > 0) {
        const languageKey = trimmedLanguage.toLowerCase();
        bindingCounter.set(languageKey, (bindingCounter.get(languageKey) ?? 0) + 1);
      }
    }
    if (entry.akomaCount > 0) {
      akomaArticles += entry.akomaCount;
    }
  }

  const residencyBreakdown = Array.from(residencyCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([zone, count]) => ({ zone, count }));

  const bindingLanguages = Array.from(bindingCounter.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([language, count]) => ({ language, count }));

  return {
    citationSummary: {
      total: totalCitations,
      allowlisted: allowlistedCount,
      ratio: totalCitations > 0 ? allowlistedCount / totalCitations : 1,
      nonAllowlisted,
      translationWarnings: Array.from(translationWarnings),
      bindingNotes,
      rules: {
        total: totalRules,
        binding: bindingRuleCount,
        nonBinding: Math.max(totalRules - bindingRuleCount, 0),
      },
    },
    retrievalSummary: {
      snippetCount,
      fileSearch: fileSearchCount,
      local: localCount,
      topHosts,
    },
    caseQuality: {
      items: caseItems,
      minScore,
      maxScore,
      forceHitl: caseQuality.forceHitl,
      treatmentGraph: treatmentGraphNodes,
      statuteAlignments: statuteSnippetDetails,
      politicalFlags: politicalFlagDetails,
    },
    risk: {
      level: payload.risk.level,
      hitlRequired: payload.risk.hitl_required || caseQuality.forceHitl,
      reason: payload.risk.why,
      verification: {
        status: verification.status,
        notes: verification.notes,
      },
    },
    provenance: {
      totalSources,
      withEli,
      withEcli,
      residencyBreakdown,
      bindingLanguages,
      akomaArticles,
    },
    compliance: complianceSummary,
  };
}

async function loadCaseQualitySummaries(
  orgId: string,
  citations: IRACPayload['citations'],
): Promise<CaseQualitySummary[]> {
  if (!Array.isArray(citations) || citations.length === 0) {
    return [];
  }

  const urls = citations
    .map((citation) => citation.url)
    .filter((url): url is string => typeof url === 'string' && url.length > 0);

  if (urls.length === 0) {
    return [];
  }

  const { data: sourceRows, error: sourceError } = await supabase
    .from('sources')
    .select('id, source_url')
    .eq('org_id', orgId)
    .in('source_url', urls);

  if (sourceError) {
    console.warn('load_case_quality_sources_failed', sourceError.message);
    return [];
  }

  const idByUrl = new Map<string, string>();
  const urlById = new Map<string, string>();
  for (const row of sourceRows ?? []) {
    if (row?.id && typeof row.source_url === 'string') {
      idByUrl.set(row.source_url, row.id);
      urlById.set(row.id, row.source_url);
    }
  }

  if (urlById.size === 0) {
    return [];
  }

  const sourceIds = Array.from(urlById.keys());

  const { data: scoreRows, error: scoreError } = await supabase
    .from('case_scores')
    .select('source_id, score_overall, axes, hard_block, notes')
    .in('source_id', sourceIds)
    .eq('org_id', orgId)
    .order('computed_at', { ascending: false });

  if (scoreError) {
    console.warn('load_case_quality_scores_failed', scoreError.message);
    return [];
  }

  const seen = new Set<string>();
  const summaries: CaseQualitySummary[] = [];
  for (const row of scoreRows ?? []) {
    if (!row?.source_id || seen.has(row.source_id)) {
      continue;
    }
    seen.add(row.source_id);
    const url = urlById.get(row.source_id);
    if (!url) {
      continue;
    }

    const axesRaw = (row.axes ?? {}) as Record<string, unknown>;
    const axes = CASE_AXES.reduce<Record<CaseScoreAxis, number>>((acc, axis) => {
      const value = axesRaw?.[axis];
      const numeric = typeof value === 'number' ? value : Number(value);
      acc[axis] = Number.isFinite(numeric) ? Number(numeric) : 0;
      return acc;
    }, {} as Record<CaseScoreAxis, number>);

    const notesValue = row.notes;
    const notes: string[] = Array.isArray(notesValue)
      ? (notesValue as unknown[]).filter((item): item is string => typeof item === 'string')
      : typeof notesValue === 'string'
        ? [notesValue]
        : [];

    summaries.push({
      sourceId: row.source_id,
      url,
      score: typeof row.score_overall === 'number' ? row.score_overall : Number(row.score_overall ?? 0),
      hardBlock: Boolean(row.hard_block),
      notes,
      axes,
      treatments: [],
      statuteAlignments: [],
      riskSignals: [],
    });
  }

  return summaries;
}

async function fetchTrustPanelForRun(
  runId: string,
  orgId: string,
  payload: IRACPayload,
  verification: VerificationResult,
): Promise<TrustPanelPayload | null> {
  try {
    const retrievalQuery = await supabase
      .from('run_retrieval_sets')
      .select('origin, snippet, similarity, weight, metadata')
      .eq('run_id', runId);

    if (retrievalQuery.error) {
      console.warn('trust_panel_retrieval_query_failed', retrievalQuery.error.message);
    }

    const retrievalSnippets: HybridSnippet[] = (retrievalQuery.data ?? []).map((row) => {
      const metadata = (row?.metadata ?? {}) as Record<string, unknown>;
      const trustTier = metadata.trustTier;
      return {
        content: typeof row?.snippet === 'string' ? row.snippet : '',
        similarity: typeof row?.similarity === 'number' ? row.similarity : 0,
        weight: typeof row?.weight === 'number' ? row.weight : 0,
        origin: row?.origin === 'file_search' ? 'file_search' : 'local',
        sourceId: typeof metadata.sourceId === 'string' ? metadata.sourceId : null,
        documentId: typeof metadata.documentId === 'string' ? metadata.documentId : null,
        fileId: typeof metadata.fileId === 'string' ? metadata.fileId : null,
        url: typeof metadata.url === 'string' ? metadata.url : null,
        title: typeof metadata.title === 'string' ? metadata.title : null,
        publisher: typeof metadata.publisher === 'string' ? metadata.publisher : null,
        trustTier:
          trustTier === 'T1' || trustTier === 'T2' || trustTier === 'T3' || trustTier === 'T4'
            ? trustTier
            : undefined,
        eli: typeof metadata.eli === 'string' ? metadata.eli : null,
        ecli: typeof metadata.ecli === 'string' ? metadata.ecli : null,
        bindingLanguage: typeof metadata.bindingLanguage === 'string' ? metadata.bindingLanguage : null,
        residencyZone: typeof metadata.residencyZone === 'string' ? metadata.residencyZone : null,
        akomaArticleCount:
          typeof metadata.akomaArticleCount === 'number' && Number.isFinite(metadata.akomaArticleCount)
            ? metadata.akomaArticleCount
            : null,
      } satisfies HybridSnippet;
    });

    const caseSummaries = await loadCaseQualitySummaries(orgId, payload.citations);
    const forceHitl = caseSummaries.some((item) => item.hardBlock || item.score < 55);
    const compliance = await fetchComplianceAssessmentForRun(runId, 'trust_panel');

    return buildTrustPanel(
      payload,
      retrievalSnippets,
      { summaries: caseSummaries, forceHitl, statuteAlignments: [], treatmentGraph: [], riskFlags: [] },
      verification,
      compliance,
    );
  } catch (error) {
    console.warn('trust_panel_fetch_failed', error);
    return null;
  }
}

async function persistRun(
  input: AgentRunInput,
  payload: IRACPayload,
  toolLogs: ToolInvocationLog[],
  retrievalSnippets: HybridSnippet[],
  telemetry: ToolTelemetry[],
  learningJobs: Array<{ type: string; payload: unknown }>,
  complianceEvents: ComplianceEventRecord[] = [],
  complianceAssessment: ComplianceAssessment | null = null,
  planTrace: AgentPlanStep[] = [],
  verification: VerificationResult,
  agentProfile: SelectedAgentProfile,
  runKey: string | null = null,
  confidentialMode = false,
  allowlistViolations: string[] = [],
): Promise<{ runId: string; trust: TrustPanelPayload; compliance: ComplianceAssessment | null }> {
  const startedAt = new Date().toISOString();
  normaliseRuleKinds(payload);
  augmentProvenanceFromSnippets(payload, retrievalSnippets);
  if (allowlistViolations.length > 0) {
    flagQuarantine(payload, 'allowlist_violation');
  }

  const insertPayload = {
    org_id: input.orgId,
    user_id: input.userId,
    question: input.question,
    jurisdiction_json: payload.jurisdiction,
    model: env.AGENT_MODEL,
    risk_level: payload.risk.level,
    hitl_required: payload.risk.hitl_required,
    confidential_mode: confidentialMode,
    irac: payload,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: 'completed',
    plan_trace: planTrace,
    run_key: runKey,
    verification_status: verification.status,
    verification_notes: verification.notes,
    agent_code: agentProfile.manifestCode,
    agent_profile: {
      key: agentProfile.key,
      code: agentProfile.manifestCode,
      label: agentProfile.label,
      tools: agentProfile.allowedToolKeys,
      settings: agentProfile.settings,
    },
  };

  const { data: runData, error: runError } = await supabase
    .from('agent_runs')
    .insert(insertPayload)
    .select('id')
    .single();

  if (runError || !runData) {
    if ((runError as { code?: string } | null)?.code === '23505' && runKey) {
      const existing = await supabase
        .from('agent_runs')
        .select('id')
        .eq('org_id', input.orgId)
        .eq('run_key', runKey)
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing.data?.id) {
        const restoredTrust =
          (await fetchTrustPanelForRun(existing.data.id as string, input.orgId, payload, verification)) ??
          buildTrustPanel(
            payload,
            retrievalSnippets,
            { summaries: [], forceHitl: payload.risk.hitl_required },
            verification,
            complianceAssessment ?? null,
          );
        return {
          runId: existing.data.id as string,
          trust: restoredTrust,
          compliance: complianceAssessment ?? null,
        };
      }
    }
    throw new Error(runError?.message ?? 'Unable to persist agent run');
  }

  if (toolLogs.length > 0) {
    const records = toolLogs.map((log) => ({
      run_id: runData.id,
      tool_name: log.name,
      args: log.args,
      output: typeof log.output === 'string' ? log.output : JSON.stringify(log.output),
    }));
    const { error: toolError } = await supabase.from('tool_invocations').insert(records);
    if (toolError) {
      throw new Error(toolError.message);
    }
  }

  if (!confidentialMode && retrievalSnippets.length > 0) {
    const retrievalRecords = retrievalSnippets.map((snippet) => ({
      run_id: runData.id,
      org_id: input.orgId,
      origin: snippet.origin,
      snippet: snippet.content,
      similarity: Number.isFinite(snippet.similarity) ? snippet.similarity : null,
      weight: Number.isFinite(snippet.weight) ? snippet.weight : null,
      metadata: {
        sourceId: snippet.sourceId ?? null,
        documentId: snippet.documentId ?? null,
        fileId: snippet.fileId ?? null,
        url: snippet.url ?? null,
        title: snippet.title ?? null,
        publisher: snippet.publisher ?? null,
        trustTier: snippet.trustTier ?? null,
        eli: snippet.eli ?? null,
        ecli: snippet.ecli ?? null,
        bindingLanguage: snippet.bindingLanguage ?? null,
        residencyZone: snippet.residencyZone ?? null,
        akomaArticleCount: snippet.akomaArticleCount ?? null,
      },
    }));
    const { error: retrievalError } = await supabase.from('run_retrieval_sets').insert(retrievalRecords);
    if (retrievalError) {
      throw new Error(retrievalError.message);
    }
  }

  if (!confidentialMode && telemetry.length > 0) {
    const telemetryRecords = telemetry.map((entry) => ({
      org_id: input.orgId,
      run_id: runData.id,
      tool_name: entry.name,
      latency_ms: Math.round(entry.latencyMs),
      success: entry.success,
      error_code: entry.errorCode ?? null,
    }));
    const { error: telemetryError } = await supabase.from('tool_telemetry').insert(telemetryRecords);
    if (telemetryError) {
      throw new Error(telemetryError.message);
    }
  }

  if (payload.citations.length > 0) {
    const inserts = payload.citations.map((citation) => ({
      run_id: runData.id,
      title: citation.title,
      publisher: citation.court_or_publisher,
      date: citation.date,
      url: citation.url,
      domain_ok: isUrlAllowlisted(citation.url),
    }));

    const { error: citationError } = await supabase.from('run_citations').insert(inserts);
    if (citationError) {
      throw new Error(citationError.message);
    }
  }

  if (complianceEvents.length > 0) {
    const auditRecords = complianceEvents.map((event) => ({
      org_id: input.orgId,
      actor_user_id: input.userId,
      kind: event.kind,
      object: `agent_run:${runData.id}`,
      before_state: null,
      after_state: null,
      metadata: event.metadata ?? null,
    }));

    const { error: auditError } = await supabase.from('audit_events').insert(auditRecords);
    if (auditError) {
      console.warn('audit_event_insert_failed', auditError.message);
    }
  }

  if (complianceAssessment) {
    const { error: complianceError } = await supabase.from('compliance_assessments').insert({
      org_id: input.orgId,
      run_id: runData.id,
      fria_required: complianceAssessment.fria.required,
      fria_reasons: complianceAssessment.fria.reasons,
      cepej_passed: complianceAssessment.cepej.passed,
      cepej_violations: complianceAssessment.cepej.violations,
      statute_passed: complianceAssessment.statute.passed,
      statute_violations: complianceAssessment.statute.violations,
      disclosures_missing: complianceAssessment.disclosures.missing,
    });
    if (complianceError) {
      console.warn('compliance_assessment_insert_failed', complianceError.message);
    }

    if (!complianceAssessment.statute.passed) {
      flagQuarantine(payload, 'statute_alignment');
    }
    if (complianceAssessment.disclosures.missing.length > 0) {
      flagQuarantine(payload, 'disclosure_gap');
    }
  }

  if (payload.risk.hitl_required || payload.risk.level === 'HIGH') {
    const { error: hitlError } = await supabase.from('hitl_queue').insert({
      run_id: runData.id,
      org_id: input.orgId,
      reason: payload.risk.hitl_required
        ? 'Agent a requis une revue humaine explicite.'
        : 'Niveau de risque élevé détecté.',
      status: 'pending',
    });
    if (hitlError) {
      throw new Error(hitlError.message);
    }
  }

  if (learningJobs.length > 0) {
    const learningRecords = learningJobs.map((job) => ({
      org_id: input.orgId,
      type: job.type,
      payload: job.payload,
    }));
    const { error: learningError } = await supabase.from('agent_learning_jobs').insert(learningRecords);
    if (learningError) {
      throw new Error(learningError.message);
    }
  }

  const caseQuality = await computeCaseQuality(
    input.orgId,
    payload.jurisdiction?.country ?? null,
    payload.citations,
  );
  augmentProvenanceWithCaseAlignments(payload, caseQuality.statuteAlignments);
  if (caseQuality.forceHitl) {
    const { error: riskUpdateError } = await supabase
      .from('agent_runs')
      .update({ risk_level: 'HIGH', hitl_required: true })
      .eq('id', runData.id);

    if (riskUpdateError) {
      console.warn('agent_run_risk_update_failed', riskUpdateError.message);
    }

    const { data: existingHitl, error: hitlLookupError } = await supabase
      .from('hitl_queue')
      .select('id')
      .eq('run_id', runData.id)
      .maybeSingle();

    if (hitlLookupError && hitlLookupError.code !== 'PGRST116') {
      console.warn('hitl_queue_lookup_failed', hitlLookupError.message);
    }

    if (!existingHitl) {
      const { error: extraHitlError } = await supabase.from('hitl_queue').insert({
        run_id: runData.id,
        org_id: input.orgId,
        reason: 'Revue obligatoire : jurisprudence à faible fiabilité ou blocage détecté.',
        status: 'pending',
      });
      if (extraHitlError) {
        console.warn('hitl_queue_insert_failed', extraHitlError.message);
      }
    }
  }

  const { error: iracUpdateError } = await supabase
    .from('agent_runs')
    .update({ irac: payload })
    .eq('id', runData.id);
  if (iracUpdateError) {
    console.warn('agent_run_irac_update_failed', iracUpdateError.message);
  }

  const trustPanel = buildTrustPanel(
    payload,
    retrievalSnippets,
    caseQuality,
    verification,
    complianceAssessment ?? null,
  );

  return { runId: runData.id as string, trust: trustPanel, compliance: complianceAssessment ?? null };
}

function buildInstructions(
  routing: RoutingResult,
  confidentialMode = false,
  allowedJurisdictions: string[] = [],
): string {
  const segments = [
    'Tu es Avocat-AI, un agent juridique francophone senior (30 ans d\'expérience).',
    'Réponds en français sauf demande contraire.',
    'Produis toujours une analyse IRAC complète avec citations officielles et précise le statut linguistique.',
    'Utilise en premier lieu l’outil route_jurisdiction pour confirmer la juridiction avant d’apporter une réponse.',
    'Appuie-toi sur les outils fournis (lookup_code_article, deadline_calculator, ohada_uniform_act, limitation_check, interest_calculator, generate_pleading_template) pour étayer ta réponse.',
    'Ne cite que des sources appartenant aux domaines officiels autorisés. Si aucune source fiable n’est disponible, recommande une revue humaine.',
    'Priorise OHADA et CCJA pour les États membres avant de recourir au droit interne.',
  ];

  if (confidentialMode) {
    segments.push(
      'Mode confidentiel actif : n’utilise que File Search et les documents internes ; n’ouvre pas la recherche web.',
    );
  }

  if (allowedJurisdictions.length > 0) {
    segments.push(
      `Juridictions autorisées pour ce locataire: ${allowedJurisdictions
        .map((code) => code.toUpperCase())
        .join(', ')}. Refuse ou escalade au HITL si la demande sort de ce périmètre.`,
    );
  }

  if (routing.primary) {
    segments.push(
      `Juridiction pressentie: ${routing.primary.country} (EU=${routing.primary.eu ? 'oui' : 'non'}, OHADA=${routing.primary.ohada ? 'oui' : 'non'}). Confiance ${Math.round(
        routing.primary.confidence * 100,
      )}%. ${routing.primary.rationale}`,
    );
  }

  if (routing.candidates.length > 1) {
    segments.push(
      `Autres juridictions possibles: ${routing.candidates
        .slice(1)
        .map((candidate) => `${candidate.country} (${Math.round(candidate.confidence * 100)}%)`)
        .join(', ')}.`,
    );
  }

  routing.warnings.forEach((warning) => segments.push(`Avertissement: ${warning}`));
  return segments.join('\n');
}

function formatOhadaInsight(question: string, routing: RoutingResult): string | null {
  if (!routing.primary?.ohada) {
    return null;
  }
  const mapping = resolveOhadaTopic(question);
  if (!mapping) {
    return null;
  }

  return `Orientation OHADA: ${mapping.data.act}, articles ${mapping.data.articles.join(', ')}. ${mapping.data.note}`;
}

function formatDeadlineInsight(question: string): string | null {
  if (!/d\u00e9lai|prescription|forclusion/i.test(question)) {
    return null;
  }
  const result = runDeadlineCalculator(question);
  return `Estimation de délai: ${result.deadline} (${result.reasoning})`;
}

const FR_ANALYTICS_JUDGE_TERMS = [
  'juge',
  'juges',
  'magistrat',
  'magistrats',
  'magistrature',
  'cour de cassation',
  'cour d\'appel',
];

const FR_ANALYTICS_ACTION_TERMS = [
  'statistique',
  'statistiques',
  'statistic',
  'profilage',
  'profil',
  'notation',
  'noter',
  'classement',
  'score',
  'scoring',
  'pr\u00e9dictif',
  'predictif',
  'pr\u00e9diction',
  'prediction',
  'analyse',
  'analyser',
  'analytiques',
  'performance',
  'comparer',
];

function normaliseForGuardrail(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function enforceFranceJudgeAnalyticsBan(question: string, routing: RoutingResult): FranceAnalyticsGuardResult {
  const normalized = normaliseForGuardrail(question);
  const mentionsJudge = FR_ANALYTICS_JUDGE_TERMS.some((term) => normalized.includes(term));
  const mentionsAnalytics = FR_ANALYTICS_ACTION_TERMS.some((term) => normalized.includes(term));

  if (!mentionsJudge || !mentionsAnalytics) {
    return { triggered: false, rationale: '' };
  }

  const franceContext =
    routing.primary?.country === 'FR' ||
    routing.candidates.some((candidate) => candidate.country === 'FR' && candidate.confidence >= 0.2) ||
    normalized.includes('france') ||
    normalized.includes('hexagone');

  if (!franceContext) {
    return { triggered: false, rationale: '' };
  }

  return {
    triggered: true,
    rationale:
      "L'article L10 du Code de l'organisation judiciaire interdit la mise à disposition de données permettant d'évaluer, d'analyser ou de prédire le comportement d'un magistrat.",
  };
}

async function findCodeReference(
  orgId: string,
  jurisdiction: string | null,
  code: string | undefined,
  article: string | undefined,
): Promise<unknown> {
  if (!jurisdiction) {
    return null;
  }

  let query = supabase
    .from('sources')
    .select('id, title, source_url, publisher, consolidated, effective_date')
    .eq('org_id', orgId)
    .eq('jurisdiction_code', jurisdiction);

  if (code) {
    query = query.ilike('title', `%${code}%`);
  }

  const { data, error } = await query.limit(5);
  if (error) {
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return null;
  }

  const normalizedArticle = article ? article.replace(/\s+/g, ' ').toLowerCase() : null;
  const match = normalizedArticle
    ? data.find((entry) => entry.title.toLowerCase().includes(normalizedArticle)) ?? data[0]
    : data[0];

  return match;
}

function normaliseMatterType(value: string | undefined): string {
  if (!value) {
    return 'assignation';
  }
  const lower = value.toLowerCase();
  if (lower.includes('assign')) return 'assignation';
  if (lower.includes('demeure')) return 'miseEnDemeure';
  if (lower.includes('contrat')) return 'contrats';
  if (lower.includes('proc')) return 'procesVerbal';
  if (lower.includes('protocole')) return 'protocole';
  return value;
}

function buildJurisdictionCandidates(
  context: AgentExecutionContext,
  explicit: string | null,
): string[] {
  const candidates = new Set<string>();
  if (explicit) {
    candidates.add(explicit);
  }
  if (context.lastJurisdiction?.country) {
    candidates.add(context.lastJurisdiction.country);
  }
  if (context.initialRouting.primary?.country) {
    candidates.add(context.initialRouting.primary.country);
  }
  if (context.initialRouting.primary?.ohada) {
    candidates.add('OHADA');
  }
  candidates.add('FR');
  return Array.from(candidates);
}

async function fetchPleadingTemplate(
  orgId: string,
  jurisdictionCandidates: string[],
  matterType: string,
  locale?: string,
) {
  if (jurisdictionCandidates.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('pleading_templates')
    .select('id, org_id, jurisdiction_code, matter_type, title, summary, sections, fill_ins, locale')
    .in('jurisdiction_code', jurisdictionCandidates)
    .eq('matter_type', matterType)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('org_id', { ascending: false, nullsLast: true })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('pleading_template_query_failed', error.message);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const localeLower = locale?.toLowerCase();
  const ordered = data.sort((a, b) => {
    const indexA = jurisdictionCandidates.indexOf(a.jurisdiction_code);
    const indexB = jurisdictionCandidates.indexOf(b.jurisdiction_code);
    return indexA - indexB;
  });

  const preferred = localeLower
    ? ordered.find((entry) => entry.locale?.toLowerCase() === localeLower) ?? ordered[0]
    : ordered[0];

  return preferred ?? null;
}

function recordTelemetry(
  context: AgentExecutionContext,
  telemetry: ToolTelemetry[],
  entry: ToolTelemetry,
): void {
  if (context.confidentialMode) {
    return;
  }
  telemetry.push(entry);
}

function buildAgent(
  toolLogs: ToolInvocationLog[],
  telemetry: ToolTelemetry[],
  context: AgentExecutionContext,
): Agent<AgentExecutionContext, typeof IRACSchema> {
  const allowedSet = new Set(context.allowedTools ?? []);
  const allowTool = (key: string) => (allowedSet.size === 0 ? true : allowedSet.has(key));

  const routeJurisdictionTool = tool<AgentExecutionContext>({
    name: 'route_jurisdiction',
    description:
      'Analyse la question pour identifier la juridiction pertinente et signaler les overlays (UE, OHADA, Maghreb).',
    parameters: z
      .object({
        question: z.string().optional(),
        context: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'route_jurisdiction');
      const started = performance.now();
      try {
        const question = input.question ?? runContext.context.prompt;
        const ctx = input.context ?? runContext.context.supplementalContext;
        const result = detectJurisdiction(question, ctx);
        runContext.context.lastJurisdiction = result.primary;
        toolLogs.push({
          name: 'routeJurisdiction',
          args: { question, context: ctx },
          output: result,
        });
        recordTelemetry(runContext.context, telemetry, {
          name: 'route_jurisdiction',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(result);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'route_jurisdiction',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const lookupCodeArticleTool = tool<AgentExecutionContext>({
    name: 'lookup_code_article',
    description: "Retrouve l'URL officielle d'un article de code dans la juridiction courante.",
    parameters: z
      .object({
        jurisdiction: z.string().optional(),
        code: z.string().optional(),
        article: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'lookup_code_article');
      const started = performance.now();
      const jurisdiction =
        input.jurisdiction ?? runContext.context.lastJurisdiction?.country ?? runContext.context.initialRouting.primary?.country ?? null;
      try {
        const data = await findCodeReference(runContext.context.orgId, jurisdiction, input.code, input.article);
        toolLogs.push({
          name: 'lookupCodeArticle',
          args: { jurisdiction, code: input.code, article: input.article },
          output: data,
        });
        recordTelemetry(runContext.context, telemetry, {
          name: 'lookup_code_article',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(data);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'lookup_code_article',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const deadlineCalculatorTool = tool<AgentExecutionContext>({
    name: 'deadline_calculator',
    description: 'Fournit un délai procédural estimatif et des notes méthodologiques.',
    parameters: z
      .object({
        start_date: z.string().optional(),
        procedure_type: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'deadline_calculator');
      const started = performance.now();
      try {
        const referenceText = `${runContext.context.prompt}\n${runContext.context.supplementalContext ?? ''}`;
        const result = runDeadlineCalculator(referenceText, input.start_date);
        toolLogs.push({
          name: 'deadlineCalculator',
          args: { start_date: input.start_date, procedure_type: input.procedure_type },
          output: result,
        });
        recordTelemetry(runContext.context, telemetry, {
          name: 'deadline_calculator',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(result);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'deadline_calculator',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const ohadaUniformActTool = tool<AgentExecutionContext>({
    name: 'ohada_uniform_act',
    description: 'Identifie les Actes uniformes OHADA pertinents pour un sujet donné.',
    parameters: z
      .object({
        topic: z.string(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'ohada_uniform_act');
      const started = performance.now();
      try {
        const mapping = resolveOhadaTopic(input.topic);
        const lastJurisdiction = runContext.context.lastJurisdiction;
        const output =
          mapping && (lastJurisdiction?.ohada ?? false)
            ? { act: mapping.data.act, articles: mapping.data.articles, note: mapping.data.note }
            : null;
        toolLogs.push({ name: 'ohadaUniformAct', args: input, output });
        recordTelemetry(runContext.context, telemetry, {
          name: 'ohada_uniform_act',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'ohada_uniform_act',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const limitationTool = tool<AgentExecutionContext>({
    name: 'limitation_check',
    description: 'Estime un délai de prescription à partir des standards juridiques.',
    parameters: z
      .object({
        jurisdiction: z.string().optional(),
        claim_type: z.string().optional(),
        start_date: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'limitation_check');
      const started = performance.now();
      try {
        const jurisdiction =
          input.jurisdiction ?? runContext.context.lastJurisdiction?.country ?? runContext.context.initialRouting.primary?.country ?? 'FR';
        const info = DEFAULT_LIMITATIONS[jurisdiction] ?? { years: 5, reference: 'Prescription quinquennale par défaut.' };
        const startDate = input.start_date ? new Date(input.start_date) : new Date();
        const deadline = new Date(startDate);
        deadline.setFullYear(deadline.getFullYear() + info.years);
        const output = {
          jurisdiction,
          limit_years: info.years,
          deadline: deadline.toISOString().slice(0, 10),
          reference: info.reference,
        };
        toolLogs.push({ name: 'limitationCheck', args: input, output });
        recordTelemetry(runContext.context, telemetry, {
          name: 'limitation_check',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'limitation_check',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const interestTool = tool<AgentExecutionContext>({
    name: 'interest_calculator',
    description: 'Calcule des intérêts légaux simples pour un principal donné.',
    parameters: z
      .object({
        jurisdiction: z.string().optional(),
        principal: z.number(),
        start_date: z.string(),
        end_date: z.string().optional(),
        rate_type: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'interest_calculator');
      const started = performance.now();
      try {
        const jurisdiction = input.jurisdiction ?? runContext.context.lastJurisdiction?.country ?? 'FR';
        const rate = LEGAL_INTEREST_DEFAULT[jurisdiction] ?? LEGAL_INTEREST_DEFAULT.FR;
        const start = new Date(input.start_date);
        const end = input.end_date ? new Date(input.end_date) : new Date();
        const durationMs = end.getTime() - start.getTime();
        const years = Math.max(durationMs / (1000 * 60 * 60 * 24 * 365), 0);
        const interest = input.principal * rate * years;
        const output = {
          jurisdiction,
          rate,
          interest_amount: Number(interest.toFixed(2)),
          years: Number(years.toFixed(3)),
          note: 'Calcul simple à vérifier selon taux officiels publiés.',
        };
        toolLogs.push({ name: 'interestCalculator', args: input, output });
        recordTelemetry(runContext.context, telemetry, {
          name: 'interest_calculator',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'interest_calculator',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const bindingLanguageTool = tool<AgentExecutionContext>({
    name: 'check_binding_language',
    description:
      'Identifie la langue juridiquement contraignante pour une source donnée et précise si une bannière d’avertissement est requise.',
    parameters: z
      .object({
        url: z.string().url().optional(),
        jurisdiction: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'check_binding_language');
      const started = performance.now();
      try {
        const jurisdiction =
          input.jurisdiction ?? runContext.context.lastJurisdiction?.country ?? runContext.context.initialRouting.primary?.country ?? null;
        const info = determineBindingLanguage(jurisdiction, input.url);
        const output = {
          jurisdiction: info.jurisdiction,
          binding_lang: info.bindingLang,
          translation_notice: info.translationNotice ?? null,
          requires_banner: info.requiresBanner,
          source: info.source,
          rationale: info.rationale,
        };
        toolLogs.push({ name: 'checkBindingLanguage', args: input, output });
        recordTelemetry(runContext.context, telemetry, {
          name: 'check_binding_language',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'check_binding_language',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const validateCitationTool = tool<AgentExecutionContext>({
    name: 'validate_citation',
    description: 'Vérifie qu’une URL appartient au périmètre autorisé et précise la marche à suivre sinon.',
    parameters: z
      .object({
        url: z.string().url(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'validate_citation');
      const started = performance.now();
      try {
        const host = new URL(input.url).hostname;
        const allowlisted = isUrlAllowlisted(input.url);
        const output = {
          url: input.url,
          domain: host,
          allowlisted,
          recommendation: allowlisted
            ? 'Citation conforme aux domaines officiels.'
            : 'Domaine hors périmètre: relancer avec site:<domaine_officiel> ou escalader HITL.',
        };
        toolLogs.push({ name: 'validateCitation', args: input, output });
        recordTelemetry(runContext.context, telemetry, {
          name: 'validate_citation',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'validate_citation',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const redlineTool = tool<AgentExecutionContext>({
    name: 'redline_contract',
    description:
      'Compare deux versions de clause ou de contrat et retourne un diff structuré avec recommandations.',
    parameters: z
      .object({
        base_text: z.string(),
        proposed_text: z.string(),
        jurisdiction: z.string().optional(),
        title: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'redline_contract');
      const started = performance.now();
      try {
        const diffParts = diffWordsWithSpace(input.base_text, input.proposed_text);
        let additions = 0;
        let deletions = 0;
        const changes = diffParts.map((part) => {
          if (part.added) additions += part.value.length;
          if (part.removed) deletions += part.value.length;
          return {
            type: part.added ? 'added' : part.removed ? 'removed' : 'context',
            text: part.value,
          };
        });
        const summary = {
          additions,
          deletions,
          net: additions - deletions,
        };
        const jurisdiction = input.jurisdiction ?? runContext.context.lastJurisdiction?.country ?? null;
        const output = {
          title: input.title ?? 'Redline',
          jurisdiction,
          summary,
          changes,
          recommendation:
            additions > deletions
              ? "Vérifier les ajouts: possible extension des obligations; escalade HITL recommandée."
              : 'Peu de modifications additionnelles; confirmer cohérence juridique.',
        };
        toolLogs.push({
          name: 'redlineContract',
          args: {
            jurisdiction,
            title: input.title,
            baseLength: input.base_text.length,
            proposedLength: input.proposed_text.length,
          },
          output,
        });
        recordTelemetry(runContext.context, telemetry, {
          name: 'redline_contract',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'redline_contract',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const snapshotAuthorityTool = tool<AgentExecutionContext>({
    name: 'snapshot_authority',
    description:
      'Planifie la capture d’un document officiel (PDF/HTML) pour ingestion dans le corpus autorisé et le vector store.',
    parameters: z
      .object({
        url: z.string().url(),
        jurisdiction: z.string().optional(),
        title: z.string().optional(),
        notes: z.string().optional(),
        priority: z.number().int().min(-5).max(10).optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'snapshot_authority');
      const started = performance.now();
      try {
        const { data, error } = await supabase
          .from('agent_task_queue')
          .insert({
            type: 'authority_snapshot',
            org_id: runContext.context.orgId,
            priority: input.priority ?? 5,
            payload: {
              url: input.url,
              jurisdiction: input.jurisdiction ?? runContext.context.lastJurisdiction?.country ?? null,
              title: input.title ?? null,
              notes: input.notes ?? null,
            },
          })
          .select('id')
          .single();

        if (error) {
          throw new Error(error.message);
        }

        const output = {
          task_id: data?.id ?? null,
          status: 'queued',
          message: "Requête de capture planifiée pour ingestion officielle.",
        };
        toolLogs.push({ name: 'snapshotAuthority', args: input, output });
        recordTelemetry(runContext.context, telemetry, {
          name: 'snapshot_authority',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'snapshot_authority',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const generateTemplateTool = tool<AgentExecutionContext>({
    name: 'generate_pleading_template',
    description:
      'Retourne un modèle de plaidoirie structuré (sections et champs à renseigner) pour la juridiction détectée.',
    parameters: z
      .object({
        jurisdiction: z.string().optional(),
        matter_type: z.string().optional(),
        locale: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'generate_pleading_template');
      const started = performance.now();
      try {
        const matterType = normaliseMatterType(input.matter_type);
        const candidates = buildJurisdictionCandidates(
          runContext.context,
          input.jurisdiction ?? null,
        );
        const template = await fetchPleadingTemplate(
          runContext.context.orgId,
          candidates,
          matterType,
          input.locale,
        );

        const defaultSections = [
          { heading: 'Faits', body: 'Présenter les faits essentiels et les pièces majeures.' },
          { heading: 'Arguments', body: 'Exposer les fondements juridiques avec références officielles.' },
          { heading: 'Conclusions', body: 'Formuler les demandes et mesures sollicitées.' },
        ];

        const sections = Array.isArray(template?.sections)
          ? (template?.sections as Array<{ heading?: string; body?: string }>).
              filter((section) => typeof section?.heading === 'string' && typeof section?.body === 'string').
              map((section) => ({ heading: section.heading as string, body: section.body as string }))
          : defaultSections;

        const fillIns = Array.isArray(template?.fill_ins)
          ? (template?.fill_ins as unknown[])
              .filter((item): item is string => typeof item === 'string' && item.length > 0)
          : ['Parties', 'Demandes', 'Références'];

        const payload = {
          title: template?.title ?? 'Modèle générique',
          summary:
            template?.summary ??
            "Aucun modèle dédié trouvé : soumettre en revue humaine avant diffusion externe.",
          jurisdiction: template?.jurisdiction_code ?? candidates[0] ?? 'FR',
          matter_type: template?.matter_type ?? matterType,
          locale: template?.locale ?? input.locale ?? 'fr',
          doc_sections: sections,
          fill_ins: fillIns,
        };

        toolLogs.push({
          name: 'generatePleadingTemplate',
          args: {
            jurisdiction: input.jurisdiction ?? runContext.context.lastJurisdiction?.country ?? null,
            matterType,
            locale: input.locale ?? null,
          },
          output: payload,
        });

        recordTelemetry(runContext.context, telemetry, {
          name: 'generate_pleading_template',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });

        return JSON.stringify(payload);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'generate_pleading_template',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const caseAlignmentTool = tool<AgentExecutionContext>({
    name: 'evaluate_case_alignment',
    description:
      "Expose les liens entre une décision jurisprudentielle et les textes applicables (articles de codes, règlements, actes uniformes).",
    parameters: z
      .object({
        case_url: z.string().url(),
        jurisdiction: z.string().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'evaluate_case_alignment');
      const started = performance.now();
      try {
        const { data: sourceRow, error: sourceError } = await supabase
          .from('sources')
          .select('id, source_url, title, jurisdiction_code')
          .eq('org_id', runContext.context.orgId)
          .eq('source_url', input.case_url)
          .maybeSingle();

        if (sourceError) {
          throw new Error(sourceError.message);
        }
        if (!sourceRow?.id) {
          return JSON.stringify({
            status: 'not_found',
            message: "Aucune décision ne correspond à cette URL dans le corpus ingéré.",
          });
        }

        const { data: links, error: linksError } = await supabase
          .from('case_statute_links')
          .select('statute_url, article, alignment_score, rationale_json')
          .eq('org_id', runContext.context.orgId)
          .eq('case_source_id', sourceRow.id);

        if (linksError) {
          throw new Error(linksError.message);
        }

        const payload = {
          status: 'ok',
          case: { url: sourceRow.source_url, title: sourceRow.title, jurisdiction: sourceRow.jurisdiction_code },
          alignments: (links ?? []).map((entry) => ({
            statute_url: entry.statute_url,
            article: entry.article,
            alignment_score: entry.alignment_score,
            rationale: entry.rationale_json,
          })),
        };

        toolLogs.push({
          name: 'evaluate_case_alignment',
          args: { case_url: input.case_url, jurisdiction: input.jurisdiction ?? null },
          output: payload,
        });

        recordTelemetry(runContext.context, telemetry, {
          name: 'evaluate_case_alignment',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });

        return JSON.stringify(payload);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'evaluate_case_alignment',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const computeCaseScoreTool = tool<AgentExecutionContext>({
    name: 'compute_case_score',
    description: 'Calcule et enregistre un score de fiabilité pour une décision jurisprudentielle existante.',
    parameters: z
      .object({
        source_id: z.string(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'compute_case_score');
      const started = performance.now();
      try {
        const result = await computeCaseScoreForSource(runContext.context.orgId, input.source_id);
        const output =
          result.status === 'ok'
            ? {
                status: 'ok',
                source_id: result.sourceId,
                score: result.score,
                hard_block: result.hardBlock,
                notes: result.notes,
                version: result.version,
              }
            : { status: 'not_found' };
        toolLogs.push({ name: 'computeCaseScore', args: input, output });
        recordTelemetry(runContext.context, telemetry, {
          name: 'compute_case_score',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'compute_case_score',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const buildTreatmentGraphTool = tool<AgentExecutionContext>({
    name: 'build_treatment_graph',
    description:
      'Planifie la reconstruction du graphe de traitements jurisprudentiels (followed/criticised) à partir des décisions ingérées.',
    parameters: z
      .object({
        since: z.string().datetime().optional(),
      })
      .strict(),
    execute: async (input, runContext) => {
      consumeToolBudget(runContext.context, 'build_treatment_graph');
      const started = performance.now();
      try {
        const jobInsert = await supabase
          .from('agent_learning_jobs')
          .insert({
            org_id: runContext.context.orgId,
            type: 'treatment_graph_rebuild',
            status: 'pending',
            payload: {
              since: input.since ?? null,
              triggered_by: runContext.context.userId,
            },
          })
          .select('id')
          .single();

        if (jobInsert.error) {
          throw new Error(jobInsert.error.message);
        }

        const output = {
          status: 'queued',
          job_id: jobInsert.data?.id ?? null,
        };
        toolLogs.push({ name: 'buildTreatmentGraph', args: input, output });
        recordTelemetry(runContext.context, telemetry, {
          name: 'build_treatment_graph',
          latencyMs: performance.now() - started,
          success: true,
          errorCode: null,
        });
        return JSON.stringify(output);
      } catch (error) {
        recordTelemetry(runContext.context, telemetry, {
          name: 'build_treatment_graph',
          latencyMs: performance.now() - started,
          success: false,
          errorCode: error instanceof Error ? error.message : 'unknown',
        });
        throw error;
      }
    },
  });

  const baseFileSearch = fileSearchTool(env.OPENAI_VECTOR_STORE_AUTHORITIES_ID, {
    includeSearchResults: true,
    maxNumResults: 8,
  });
  const budgetedFileSearch = {
    ...baseFileSearch,
    execute: async (input: unknown, runContext: { context: AgentExecutionContext }) => {
      consumeToolBudget(runContext.context, 'file_search');
      return baseFileSearch.execute(input, runContext);
    },
  };

  const hostedTools: any[] = [];
  if (allowTool('file_search')) {
    hostedTools.push(budgetedFileSearch);
  }

  if (!context.confidentialMode && allowTool('web_search')) {
    const baseWebSearch = webSearchTool({
      filters: { allowedDomains: DOMAIN_ALLOWLIST },
      searchContextSize: 'medium',
    });
    const budgetedWebSearch = {
      ...baseWebSearch,
      execute: async (input: unknown, runContext: { context: AgentExecutionContext }) => {
        consumeToolBudget(runContext.context, 'web_search');
        return baseWebSearch.execute(input, runContext);
      },
    };
    hostedTools.unshift(budgetedWebSearch);
  }

  const outputGuardrails = [
    citationsAllowlistGuardrail,
    bindingLanguageGuardrail,
    structuredIracGuardrail,
  ];
  if (context.sensitiveTopicHitl) {
    outputGuardrails.push(sensitiveTopicGuardrail);
  }

  const functionTools: any[] = [];
  if (allowTool('route_jurisdiction')) {
    functionTools.push(routeJurisdictionTool);
  }
  if (allowTool('lookup_code_article')) {
    functionTools.push(lookupCodeArticleTool);
  }
  if (allowTool('deadline_calculator')) {
    functionTools.push(deadlineCalculatorTool);
  }
  if (allowTool('ohada_uniform_act')) {
    functionTools.push(ohadaUniformActTool);
  }
  if (allowTool('limitation_check')) {
    functionTools.push(limitationTool);
  }
  if (allowTool('interest_calculator')) {
    functionTools.push(interestTool);
  }
  if (allowTool('check_binding_language')) {
    functionTools.push(bindingLanguageTool);
  }
  if (allowTool('validate_citation')) {
    functionTools.push(validateCitationTool);
  }
  if (allowTool('redline_contract')) {
    functionTools.push(redlineTool);
  }
  if (allowTool('snapshot_authority')) {
    functionTools.push(snapshotAuthorityTool);
  }
  if (allowTool('generate_pleading_template')) {
    functionTools.push(generateTemplateTool);
  }
  if (allowTool('evaluate_case_alignment')) {
    functionTools.push(caseAlignmentTool);
  }
  if (allowTool('compute_case_score')) {
    functionTools.push(computeCaseScoreTool);
  }
  if (allowTool('build_treatment_graph')) {
    functionTools.push(buildTreatmentGraphTool);
  }

  return new Agent<AgentExecutionContext, typeof IRACSchema>({
    name: context.agentLabel ?? context.agentCode ?? 'avocat-francophone',
    instructions: buildInstructions(
      context.initialRouting,
      context.confidentialMode,
      context.allowedJurisdictions,
    ),
    model: env.AGENT_MODEL,
    tools: [...hostedTools, ...functionTools],
    outputType: IRACSchema,
    outputGuardrails,
  });
}

export async function runLegalAgent(
  input: AgentRunInput,
  accessContext?: OrgAccessContext,
): Promise<AgentRunResult> {
  if (!input.orgId || !input.userId) {
    throw new Error('orgId et userId sont obligatoires pour tracer la requête');
  }

  ensureOpenAIProvider();

  const toolLogs: ToolInvocationLog[] = [];
  const telemetryRecords: ToolTelemetry[] = [];
  const useStub = shouldUseStubAgent();
  const agentProfile = resolveAgentProfile(input.agentCode ?? null, input.agentSettings ?? null);
  const planner = await planRun(input, accessContext ?? null, useStub, toolLogs, agentProfile);

  const runKey = createRunKey(
    input,
    planner.initialRouting,
    planner.context.confidentialMode,
    planner.agentProfile,
  );
  const existing = await findExistingRun(runKey, input.orgId);
  if (existing) {
    const payload: IRACPayload = {
      ...existing.payload,
      risk: { ...existing.payload.risk },
    };
    applyDisclosureProvenance(payload, accessContext ?? null);
    const notices = buildRunNotices(payload, {
      accessContext: accessContext ?? null,
      confidentialMode: existing.confidentialMode ?? planner.context.confidentialMode,
      initialRouting: planner.initialRouting,
    });
    for (const notice of notices) {
      const current = payload.risk.why ?? '';
      if (!current.toLowerCase().includes(notice.message.toLowerCase())) {
        payload.risk.why = current.length > 0 ? `${current} | ${notice.message}` : notice.message;
      }
    }

    if (existing.verification.notes.length > 0) {
      const verificationSummary = existing.verification.notes.map((note) => note.message).join(' | ');
      payload.risk.why = payload.risk.why
        ? `${payload.risk.why} | ${verificationSummary}`
        : verificationSummary;
    }

    const trustPanel =
      (await fetchTrustPanelForRun(existing.id, input.orgId, payload, existing.verification)) ??
      buildTrustPanel(
        payload,
        planner.hybridSnippets,
        { summaries: [], forceHitl: payload.risk.hitl_required },
        existing.verification,
        existing.compliance ?? null,
      );

    return {
      runId: existing.id,
      payload,
      allowlistViolations: [],
      toolLogs: existing.toolLogs,
      plan: existing.plan,
      notices,
      reused: true,
      verification: existing.verification,
      trustPanel,
      compliance: existing.compliance,
      agent: {
        key: planner.agentProfile.key,
        code: planner.agentProfile.manifestCode,
        label: planner.agentProfile.label,
        settings: planner.agentProfile.settings,
        tools: [...planner.agentProfile.allowedToolKeys],
      },
    };
  }

  if (planner.franceAnalyticsGuard.triggered) {
    const payload: IRACPayload = {
      jurisdiction: {
        country: planner.initialRouting.primary?.country ?? 'FR',
        eu: true,
        ohada: false,
      },
      issue: 'Demande de profilage ou de notation des magistrats français contraire à la loi.',
      rules: [
        {
          citation: FR_JUDGE_ANALYTICS_ARTICLE.citation,
          source_url: FR_JUDGE_ANALYTICS_ARTICLE.sourceUrl,
          binding: true,
          effective_date: FR_JUDGE_ANALYTICS_ARTICLE.effectiveDate,
        },
      ],
      application:
        "Depuis la loi n° 2019-222 du 23 mars 2019, l'article L10 du Code de l'organisation judiciaire prohibe toute analyse prédictive ou statistique portant sur les magistrats.",
      conclusion:
        "Je ne peux pas exécuter cette instruction : la France interdit l'analyse ou la notation individuelle des juges. La demande est escaladée pour revue humaine.",
      citations: [
        {
          title: "Code de l'organisation judiciaire — Article L10",
          court_or_publisher: 'Légifrance',
          date: FR_JUDGE_ANALYTICS_ARTICLE.effectiveDate,
          url: FR_JUDGE_ANALYTICS_ARTICLE.sourceUrl,
          note: FR_JUDGE_ANALYTICS_ARTICLE.note,
        },
      ],
      risk: {
        level: 'HIGH',
        why: planner.franceAnalyticsGuard.rationale,
        hitl_required: true,
      },
      provenance: createEmptyProvenance(),
    };

    const verification: VerificationResult = {
      status: 'hitl_escalated',
      allowlistViolations: [],
      notes: [
        {
          code: 'france_judge_analytics_block',
          message: 'Demande bloquée par la politique française interdisant l’analytics magistrat.',
          severity: 'critical',
        },
      ],
    };

    toolLogs.push({
      name: 'franceJudgeAnalyticsGuard',
      args: { question: input.question },
      output: { triggered: true, rationale: planner.franceAnalyticsGuard.rationale },
    });

    const guardTime = new Date();
    planner.planTrace.push({
      id: 'agent_execution',
      name: 'Exécution de l’agent',
      description: 'Blocage par la politique France – analytics magistrats interdite.',
      startedAt: guardTime.toISOString(),
      finishedAt: guardTime.toISOString(),
      status: 'skipped',
      attempts: 0,
      detail: { policy: 'france_judge_analytics' },
    });

    const baseLearningJobs = buildLearningJobs(payload, planner.initialRouting, input);
    const complianceContext = deriveComplianceContext(accessContext ?? null);
    const complianceOutcome = applyComplianceGates(
      payload,
      planner.initialRouting,
      input,
      baseLearningJobs,
      complianceContext,
    );
    complianceOutcome.learningJobs.unshift({
      type: 'guardrail_fr_judge_analytics',
      payload: {
        question: input.question,
        jurisdiction: payload.jurisdiction.country,
        rationale: planner.franceAnalyticsGuard.rationale,
      },
    });
    const complianceEvents: ComplianceEventRecord[] = [
      ...complianceOutcome.events,
      {
        kind: 'compliance.france_judge_analytics.blocked',
        metadata: {
          jurisdiction: payload.jurisdiction.country,
          rationale: planner.franceAnalyticsGuard.rationale,
        },
      },
    ];

    const notices = buildRunNotices(payload, {
      accessContext: accessContext ?? null,
      confidentialMode: planner.context.confidentialMode,
      initialRouting: planner.initialRouting,
    });
    for (const notice of notices) {
      const current = payload.risk.why ?? '';
      if (!current.toLowerCase().includes(notice.message.toLowerCase())) {
        payload.risk.why = current.length > 0 ? `${current} | ${notice.message}` : notice.message;
      }
    }

    const { runId, trust } = await persistRun(
      input,
      payload,
      toolLogs,
      planner.hybridSnippets,
      telemetryRecords,
      complianceOutcome.learningJobs,
      complianceEvents,
      complianceOutcome.assessment,
      planner.planTrace,
      verification,
      planner.agentProfile,
      runKey,
      planner.context.confidentialMode,
      [],
    );

    await recordGoNoGoEvidenceForRun({
      orgId: input.orgId,
      actorId: input.userId,
      runId,
      compliance: complianceOutcome.assessment,
      bindingInfo: null,
      notices,
      confidentialMode: planner.context.confidentialMode,
      jurisdiction: payload.jurisdiction,
      franceAnalyticsBlocked: true,
    });

    return {
      runId,
      payload,
      allowlistViolations: [],
      toolLogs,
      plan: planner.planTrace,
      notices,
      verification,
      trustPanel: trust,
      compliance: complianceOutcome.assessment,
    };
  }

  if (useStub) {
    const payload = buildStubPayload(input.question, planner.initialRouting, planner.hybridSnippets);
    toolLogs.push({ name: 'stubGenerator', args: { question: input.question }, output: payload });

    applyDisclosureProvenance(payload, accessContext ?? null);

    const stubTime = new Date();
    planner.planTrace.push({
      id: 'agent_execution',
      name: 'Exécution de l’agent',
      description: 'Mode stub actif : génération hors ligne.',
      startedAt: stubTime.toISOString(),
      finishedAt: stubTime.toISOString(),
      status: 'success',
      attempts: 1,
      detail: { mode: 'stub' },
    });

    const baseLearningJobs = buildLearningJobs(payload, planner.initialRouting, input);
    const complianceContext = deriveComplianceContext(accessContext ?? null);
    const bindingInfo = applyBindingLanguageNotices(payload, planner.initialRouting);
    const complianceOutcome = applyComplianceGates(
      payload,
      planner.initialRouting,
      input,
      baseLearningJobs,
      complianceContext,
    );
    if (bindingInfo?.requiresBanner) {
      complianceOutcome.learningJobs.push({
        type: 'binding_language_banner',
        payload: {
          jurisdiction: bindingInfo.jurisdiction,
          notice: bindingInfo.translationNotice,
          source: bindingInfo.source,
          question: input.question,
        },
      });
    }
    const notices = buildRunNotices(payload, {
      accessContext: accessContext ?? null,
      confidentialMode: planner.context.confidentialMode,
      initialRouting: planner.initialRouting,
    });

    const verification: VerificationResult = {
      status: payload.risk.hitl_required || payload.risk.level === 'HIGH' ? 'hitl_escalated' : 'passed',
      notes: [],
      allowlistViolations: [],
    };
    for (const notice of notices) {
      const current = payload.risk.why ?? '';
      if (!current.toLowerCase().includes(notice.message.toLowerCase())) {
        payload.risk.why = current.length > 0 ? `${current} | ${notice.message}` : notice.message;
      }
    }

    let runId: string;
    let trustPanel: TrustPanelPayload;
    try {
      const result = await persistRun(
        input,
        payload,
        toolLogs,
        planner.hybridSnippets,
        telemetryRecords,
        complianceOutcome.learningJobs,
        complianceOutcome.events,
        complianceOutcome.assessment,
        planner.planTrace,
        verification,
        planner.agentProfile,
        runKey,
        planner.context.confidentialMode,
        [],
      );
      runId = result.runId;
      trustPanel = result.trust;
      await recordGoNoGoEvidenceForRun({
        orgId: input.orgId,
        actorId: input.userId,
        runId,
        compliance: complianceOutcome.assessment,
        bindingInfo,
        notices,
        confidentialMode: planner.context.confidentialMode,
        jurisdiction: payload.jurisdiction,
      });
    } catch (error) {
      console.warn('persistRun_failed_stub_mode', error);
      runId = `stub-${Date.now()}`;
      trustPanel = buildTrustPanel(
        payload,
        planner.hybridSnippets,
        {
          summaries: [],
          forceHitl: payload.risk.hitl_required,
          statuteAlignments: [],
          treatmentGraph: [],
          riskFlags: [],
        },
        verification,
        complianceOutcome.assessment,
      );
    }

    return {
      runId,
      payload,
      allowlistViolations: [],
      toolLogs,
      plan: planner.planTrace,
      notices,
      verification,
      trustPanel,
      compliance: complianceOutcome.assessment,
      agent: {
        key: planner.agentProfile.key,
        code: planner.agentProfile.manifestCode,
        label: planner.agentProfile.label,
        settings: planner.agentProfile.settings,
        tools: [...planner.agentProfile.allowedToolKeys],
      },
    };
  }

  const agent = buildAgent(toolLogs, telemetryRecords, planner.context);
  let execution;
  try {
    execution = await executeAgentPlan(agent, planner, input, planner.hybridSnippets);
  } catch (error) {
    const guardResult = await handleGuardrailFailure(
      error,
      planner,
      input,
      toolLogs,
      telemetryRecords,
      runKey,
      accessContext ?? null,
    );
    if (guardResult) {
      return guardResult;
    }
    throw error;
  }
  const payload = execution.payload;

  applyDisclosureProvenance(payload, accessContext ?? null);

  const verificationTask = async () =>
    verifyAgentPayload(payload, {
      allowlistViolations: execution.allowlistViolations,
      initialRouting: planner.initialRouting,
    });

  const verification =
    (await recordPlanStep<VerificationResult>(
      planner.planTrace,
      'verification',
      'Vérification post-exécution',
      'Contrôle post-exécution des citations et de la structure IRAC.',
      verificationTask,
      {
        detail: (result) => ({
          status: result.status,
          notes: result.notes.map((note) => note.code),
        }),
      },
    )) ?? { status: 'passed', notes: [], allowlistViolations: [] };

  const bindingInfo = applyBindingLanguageNotices(payload, planner.initialRouting);
  const baseLearningJobs = buildLearningJobs(payload, planner.initialRouting, input);
  const complianceContext = deriveComplianceContext(accessContext ?? null);
  const complianceOutcome = applyComplianceGates(
    payload,
    planner.initialRouting,
    input,
    baseLearningJobs,
    complianceContext,
  );

  if (verification.notes.length > 0) {
    const verificationSummary = verification.notes.map((note) => note.message).join(' | ');
    payload.risk.why = payload.risk.why
      ? `${payload.risk.why} | ${verificationSummary}`
      : verificationSummary;
  }

  if (bindingInfo?.requiresBanner) {
    complianceOutcome.learningJobs.push({
      type: 'binding_language_banner',
      payload: {
        jurisdiction: bindingInfo.jurisdiction,
        notice: bindingInfo.translationNotice,
        source: bindingInfo.source,
        question: input.question,
      },
    });
  }

  const notices = buildRunNotices(payload, {
    accessContext: accessContext ?? null,
    confidentialMode: planner.context.confidentialMode,
    initialRouting: planner.initialRouting,
  });
  for (const notice of notices) {
    const current = payload.risk.why ?? '';
    if (!current.toLowerCase().includes(notice.message.toLowerCase())) {
      payload.risk.why = current.length > 0 ? `${current} | ${notice.message}` : notice.message;
    }
  }

  const { runId, trust: trustPanel } = await persistRun(
    input,
    payload,
    toolLogs,
    planner.hybridSnippets,
    telemetryRecords,
    complianceOutcome.learningJobs,
    complianceOutcome.events,
    complianceOutcome.assessment,
    planner.planTrace,
    verification,
    planner.agentProfile,
    runKey,
    planner.context.confidentialMode,
    execution.allowlistViolations,
  );

  await recordGoNoGoEvidenceForRun({
    orgId: input.orgId,
    actorId: input.userId,
    runId,
    compliance: complianceOutcome.assessment,
    bindingInfo,
    notices,
    confidentialMode: planner.context.confidentialMode,
    jurisdiction: payload.jurisdiction,
  });

  return {
    runId,
    payload,
    allowlistViolations: execution.allowlistViolations,
    toolLogs,
    plan: planner.planTrace,
    notices,
    verification,
    trustPanel,
    compliance: complianceOutcome.assessment,
    agent: {
      key: planner.agentProfile.key,
      code: planner.agentProfile.manifestCode,
      label: planner.agentProfile.label,
      settings: planner.agentProfile.settings,
      tools: [...planner.agentProfile.allowedToolKeys],
    },
  };
}

export type { IRACPayload } from '@avocat-ai/shared';
export { determineBindingLanguage };

declare module '@avocat-ai/shared' {
  export const AgentRunSchema: any;
  export const AgentRunRequestSchema: any;
  export const AgentStreamRequestSchema: any;
  export type AgentRun = any;
  export type ResearchStreamEvent = any;
  export const ResearchStreamPayloadSchema: any;
  export const ResearchDeskContextSchema: any;
  export type ResearchDeskContext = any;
  export type ResearchPlan = any;
  export type ResearchCitation = any;
  export const CitationsBrowserDataSchema: any;
  export type CitationDocument = any;
  export type CitationsBrowserData = any;
  export const CorpusDashboardDataSchema: any;
  export const HitlQueueDataSchema: any;
  export type HitlQueueData = any;
  export const MattersOverviewSchema: any;
  export type MattersOverview = any;
  export const PolicyConfigurationSchema: any;
  export const UploadResponseSchema: any;
  export const VoiceConsoleContextSchema: any;
  export const VoiceRunRequestSchema: any;
  export const VoiceRunResponseSchema: any;
  export const VoiceSessionTokenSchema: any;
  export type VoiceSessionToken = any;
  export type ProcessNavigatorFlow = any;
  export type WorkspaceDesk = any;
  export type OpenAIClientConfig = any;
  export function getOpenAIClient(config?: OpenAIClientConfig): any;
  export function isOpenAIDebugEnabled(): boolean;
  export interface OpenAIDebugInfo {
    requestId?: string;
    details?: unknown;
    debugError?: unknown;
  }
  export function fetchOpenAIDebugDetails(client: OpenAIClient, error: unknown): Promise<OpenAIDebugInfo | null>;
  // Orchestrator types (temporary shims)
  export type ConnectorStatus = string;
  export type ConnectorType = string;
  export interface DirectorCommandInput {
    orgId: string;
    sessionId: string | null;
    commandType: string;
    payload?: Record<string, unknown>;
    priority?: number;
    scheduledFor?: string | null;
    worker?: string;
    issuedBy: string;
  }
  export interface OrchestratorCommandRecord {
    id: string;
    orgId: string;
    sessionId: string | null;
    commandType: string;
    payload: Record<string, unknown> | null;
    status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
    priority: number;
    scheduledFor: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    failedAt?: string | null;
    result?: Record<string, unknown> | null;
    lastError?: string | null;
    metadata?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  }
  export interface OrchestratorJobRecord {
    id: string;
    orgId: string;
    commandId: string;
    worker: string;
    domainAgent?: string | null;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    attempts: number;
    scheduledAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    failedAt?: string | null;
    lastError?: string | null;
    metadata?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
  }
  export interface OrchestratorSessionRecord {
    id: string;
    orgId: string;
    status?: 'active' | 'closed';
    chatSessionId?: string | null;
    directorState?: Record<string, unknown>;
    safetyState?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    currentObjective?: string | null;
    lastDirectorRunId?: string | null;
    lastSafetyRunId?: string | null;
    createdAt?: string;
    updatedAt?: string;
    closedAt?: string | null;
  }
  export interface OrchestratorCommandEnvelope {
    command: OrchestratorCommandRecord;
    job: OrchestratorJobRecord;
    session: OrchestratorSessionRecord;
  }
  export interface OrchestratorCommandResponse {
    commandId: string;
    jobId: string;
    sessionId: string;
    status: string;
    scheduledFor?: string | null;
  }
  export interface OrgConnectorRecord {
    id: string;
    name: string;
    connectorType: string;
    status: string;
    [key: string]: unknown;
  }
  export interface SafetyAssessmentResult {
    status: 'approved' | 'rejected' | 'needs_hitl';
    reasons: string[];
    mitigations?: string[];
  }
  export type ProcessNavigatorFlow = Record<string, unknown>;
  // Agent types (temporary shims)
  export type AgentPlanNotice = Record<string, unknown>;
  export type AgentPlanStep = Record<string, unknown>;
  export type IRACPayload = Record<string, unknown>;
  export type IRACSchema = Record<string, unknown>;
  export const OFFICIAL_DOMAIN_ALLOWLIST: string[];
  export const DEFAULT_WEB_SEARCH_ALLOWLIST_MAX: number;
  export interface BuildWebSearchAllowlistOptions {
    fallback: readonly string[];
    override?: readonly unknown[] | null | undefined;
    maxDomains?: number;
    onTruncate?: (details: {
      truncatedCount: number;
      totalDomains: number;
      maxDomains: number;
      source: 'override' | 'fallback';
    }) => void;
  }
  export interface BuildWebSearchAllowlistResult {
    allowlist: string[];
    truncated: boolean;
    truncatedCount: number;
    totalDomains: number;
    source: 'override' | 'fallback';
  }
  export function buildWebSearchAllowlist(
    options: BuildWebSearchAllowlistOptions,
  ): BuildWebSearchAllowlistResult;
}

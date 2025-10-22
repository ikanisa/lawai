declare module '@avocat-ai/shared' {
  export type WorkspaceDesk = Record<string, unknown>;
  export interface OpenAIClientConfig {
    apiKey?: string;
    cacheKeySuffix?: string;
    requestTags?: string;
  }
  export interface OpenAIEmbeddingsResponse {
    data?: Array<{ embedding?: number[] }>;
  }
  export interface OpenAIResponsesResponse {
    output?: Array<{ content?: Array<{ text?: string }> }>;
    output_text?: string;
    data?: Array<{ embedding?: number[] }>;
  }
  export interface OpenAIClient {
    embeddings: {
      create(params: Record<string, unknown>): Promise<OpenAIEmbeddingsResponse>;
    };
    responses: {
      create(params: Record<string, unknown>): Promise<OpenAIResponsesResponse>;
    };
  }
  export function getOpenAIClient(config?: OpenAIClientConfig): OpenAIClient;
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
}

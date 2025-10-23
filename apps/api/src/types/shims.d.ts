declare module 'diff' {
  export function diffWordsWithSpace(a: string, b: string): Array<{ value: string; added?: boolean; removed?: boolean }>;
}

declare module '@avocat-ai/shared' {
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
  export function getOpenAIClient(config: OpenAIClientConfig): OpenAIClient;
  export function isOpenAIDebugEnabled(): boolean;
  export interface OpenAIDebugInfo {
    requestId?: string;
    details?: unknown;
    debugError?: unknown;
  }
  export function fetchOpenAIDebugDetails(
    client: OpenAIClient,
    error: unknown,
  ): Promise<OpenAIDebugInfo | null>;
  export interface OrgConnectorRecord {
    id: string;
    name: string;
    connectorType: string;
    status: string;
    [key: string]: unknown;
  }
  export type ProcessNavigatorFlow = Record<string, unknown>;

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
  export interface SafetyAssessmentResult {
    status: 'approved' | 'rejected' | 'needs_hitl';
    reasons: string[];
    mitigations?: string[];
  }

  export interface ResearchCitation {
    id: string;
    label?: string;
    title?: string;
    url?: string;
    href?: string;
    snippet?: string | null;
    type?: string;
    score?: number;
    date?: string;
  }
  export interface ResearchPlanStep {
    id: string;
    title: string;
    tool: string;
    status: string;
    summary?: string;
  }
  export interface ResearchPlan {
    id: string;
    title: string;
    jurisdiction?: string;
    riskLevel: string;
    riskSummary: string;
    steps: ResearchPlanStep[];
    [key: string]: unknown;
  }
  export interface ResearchDeskContext {
    defaultCitations: ResearchCitation[];
    plan: ResearchPlan;
    filters?: Record<string, unknown>;
    suggestions?: readonly string[];
    [key: string]: unknown;
  }
  export type ResearchStreamEvent = { type: string; data: unknown };
  export const ResearchDeskContextSchema: {
    parse(input: unknown): ResearchDeskContext;
    safeParse(
      input: unknown,
    ): { success: true; data: ResearchDeskContext } | { success: false; error: { flatten(): unknown } };
  };
  export const ResearchStreamPayloadSchema: {
    safeParse(input: unknown): { success: true; data: unknown } | { success: false; error: { flatten(): unknown } };
  };

  export interface AgentRun {
    id: string;
    agentId: string;
    threadId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    input: unknown;
    jurisdiction: string | null;
    policyFlags: string[];
  }
  export interface AgentRunRequest {
    agent_id: string;
    input: string;
    jurisdiction?: string | null;
    policy_flags?: string[];
    tools_enabled?: string[];
  }
  export interface AgentStreamRequest {
    run_id: string;
    agent_id: string;
  }
  export const AgentRunSchema: {
    parse(input: unknown): AgentRun;
    safeParse(input: unknown): { success: true; data: AgentRun } | { success: false; error: { flatten(): unknown } };
  };
  export const AgentRunRequestSchema: {
    safeParse(
      input: unknown,
    ): { success: true; data: AgentRunRequest } | { success: false; error: { flatten(): unknown } };
  };
  export const AgentStreamRequestSchema: {
    safeParse(
      input: unknown,
    ): { success: true; data: AgentStreamRequest } | { success: false; error: { flatten(): unknown } };
  };

  export interface CitationDocument {
    id: string;
    title: string;
    url: string;
    snippet?: string | null;
  }
  export interface CitationsBrowserData {
    documents: CitationDocument[];
    results: CitationDocument[];
    ohadaFeatured: CitationDocument[];
    total: number;
  }
  export const CitationsBrowserDataSchema: {
    parse(input: unknown): CitationsBrowserData;
    safeParse(
      input: unknown,
    ): { success: true; data: CitationsBrowserData } | { success: false; error: { flatten(): unknown } };
  };

  export interface PolicyConfiguration {
    [key: string]: unknown;
  }
  export interface CorpusDashboardData {
    policies: PolicyConfiguration;
    stats: Record<string, unknown>;
  }
  export const PolicyConfigurationSchema: {
    parse(input: unknown): PolicyConfiguration;
    safeParse(
      input: unknown,
    ): { success: true; data: PolicyConfiguration } | { success: false; error: { flatten(): unknown } };
    extend(shape: Record<string, unknown>): {
      parse(input: unknown): PolicyConfiguration;
      safeParse(
        input: unknown,
      ): { success: true; data: PolicyConfiguration } | { success: false; error: { flatten(): unknown } };
    };
  };
  export const CorpusDashboardDataSchema: {
    parse(input: unknown): CorpusDashboardData;
    safeParse(
      input: unknown,
    ): { success: true; data: CorpusDashboardData } | { success: false; error: { flatten(): unknown } };
    extend(shape: Record<string, unknown>): {
      parse(input: unknown): CorpusDashboardData;
      safeParse(
        input: unknown,
      ): { success: true; data: CorpusDashboardData } | { success: false; error: { flatten(): unknown } };
    };
  };

  export interface HitlQueueData {
    items: Record<string, unknown>[];
  }
  export const HitlQueueDataSchema: {
    parse(input: unknown): HitlQueueData;
    safeParse(input: unknown): { success: true; data: HitlQueueData } | { success: false; error: { flatten(): unknown } };
  };

  export interface MattersOverview {
    matters: Record<string, unknown>[];
  }
  export const MattersOverviewSchema: {
    parse(input: unknown): MattersOverview;
    safeParse(input: unknown): { success: true; data: MattersOverview } | { success: false; error: { flatten(): unknown } };
  };

  export type UploadResponse = {
    id: string;
    bucket: string;
    path: string;
    contentType: string;
    size: number;
  };
  export const UploadResponseSchema: {
    parse(input: unknown): UploadResponse;
    safeParse(
      input: unknown,
    ): { success: true; data: UploadResponse } | { success: false; error: { flatten(): unknown } };
  };

  export interface VoiceCitation {
    id: string;
    label: string;
    href: string;
    snippet: string;
  }
  export interface VoiceToolIntent {
    id: string;
    name: string;
    tool: string;
    status: string;
    detail?: string;
  }
  export interface VoiceRunResponse {
    id: string;
    summary: string;
    followUps: string[];
    citations: VoiceCitation[];
    intents: VoiceToolIntent[];
    readback: string[];
    riskLevel: string;
    clarifications: string[];
  }
  export interface VoiceRunRequest {
    transcript: string;
    context?: VoiceConsoleContext;
  }
  export interface VoiceConsoleContext {
    suggestions: string[];
    quickIntents: VoiceToolIntent[];
    recentSessions: Array<{
      id: string;
      startedAt: string;
      durationMs: number;
      transcript: string;
      summary: string;
      citations: VoiceCitation[];
      intents: VoiceToolIntent[];
    }>;
    guardrails: string[];
  }
  export interface VoiceSessionToken {
    token: string;
    expiresAt: string | null;
  }
  export const VoiceRunRequestSchema: {
    parse(input: unknown): VoiceRunRequest;
    safeParse(
      input: unknown,
    ): { success: true; data: VoiceRunRequest } | { success: false; error: { flatten(): unknown } };
  };
  export const VoiceRunResponseSchema: {
    parse(input: unknown): VoiceRunResponse;
    safeParse(
      input: unknown,
    ): { success: true; data: VoiceRunResponse } | { success: false; error: { flatten(): unknown } };
  };
  export const VoiceConsoleContextSchema: {
    parse(input: unknown): VoiceConsoleContext;
    safeParse(
      input: unknown,
    ): { success: true; data: VoiceConsoleContext } | { success: false; error: { flatten(): unknown } };
  };
  export const VoiceSessionTokenSchema: {
    parse(input: unknown): VoiceSessionToken;
    safeParse(
      input: unknown,
    ): { success: true; data: VoiceSessionToken } | { success: false; error: { flatten(): unknown } };
  };
}

declare module '@avocat-ai/shared/pwa' {
  export const AgentRunSchema: any;
  export const AgentRunRequestSchema: any;
  export const AgentStreamRequestSchema: any;
  export type ResearchStreamPayload = any;
  export const UploadResponseSchema: any;
  export const VoiceRunRequestSchema: any;
  export const VoiceSessionTokenSchema: any;
}

declare module '@avocat-ai/supabase' {
  import type {
    GenericFunction,
    GenericRelationship,
    GenericSchema,
    GenericTable,
    SupabaseClient,
  } from '@supabase/supabase-js';

  export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

  export interface ServiceTable extends GenericTable {
    Row: Record<string, Json>;
    Insert: Record<string, Json>;
    Update: Record<string, Json>;
    Relationships: GenericRelationship[];
  }

  export interface ServiceView extends GenericSchema['Views'][string] {}

  export interface ServiceFunction extends GenericFunction {}

  export interface ServiceSchema extends GenericSchema {
    Tables: Record<string, ServiceTable>;
    Views: Record<string, ServiceView>;
    Functions: Record<string, ServiceFunction>;
    Enums: Record<string, readonly string[]>;
    CompositeTypes: Record<string, Record<string, Json>>;
  }

  export type GeneratedDatabase = {
    public: ServiceSchema;
    [schema: string]: ServiceSchema;
  };

  export type ServiceDatabase<DB extends GeneratedDatabase = GeneratedDatabase> = DB & {
    __InternalSupabase?: {
      PostgrestVersion?: string;
    };
  };

  export type ServiceSupabaseClient<DB extends GeneratedDatabase = GeneratedDatabase> = SupabaseClient<any>;

  export interface SupabaseEnv {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
  }

  export function createServiceClient(env: SupabaseEnv): ServiceSupabaseClient;
}

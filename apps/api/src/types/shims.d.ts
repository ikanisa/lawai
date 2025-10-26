declare module 'diff' {
  export function diffWordsWithSpace(a: string, b: string): Array<{ value: string; added?: boolean; removed?: boolean }>;
}

import type { ZodTypeAny } from 'zod';
import type { SupabaseServiceClient } from './supabase.js';

declare module '@avocat-ai/shared' {
  export type OpenAIClientConfig = Record<string, unknown>;
  export function getOpenAIClient(config?: OpenAIClientConfig): unknown;
  export function isOpenAIDebugEnabled(): boolean;
  export function fetchOpenAIDebugDetails(client: unknown, error: unknown): Promise<unknown>;
  export interface OrgConnectorRecord {
    id?: string;
    orgId?: string;
    connectorType: string;
    name: string;
    status: string;
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
  export type DirectorCommandInput = Record<string, unknown>;
  export type OrchestratorCommandEnvelope = Record<string, unknown>;
  export type OrchestratorCommandRecord = Record<string, unknown>;
  export type OrchestratorCommandResponse = Record<string, unknown>;
  export type OrchestratorJobRecord = Record<string, unknown>;
  export type OrchestratorSessionRecord = Record<string, unknown>;
  export type SafetyAssessmentResult = Record<string, unknown>;
  export type AgentPlanNotice = Record<string, unknown>;
  export type AgentPlanStep = Record<string, unknown>;
  export type IRACPayload = Record<string, unknown>;
  export const IRACSchema: ZodTypeAny;
  export const OFFICIAL_DOMAIN_ALLOWLIST: readonly string[];

  export interface AgentRun {
    id: string;
    status?: string;
    [key: string]: unknown;
  }
  export type ResearchStreamEvent = Record<string, unknown>;
  export type ResearchStreamPayload = Record<string, unknown>;
  export const AgentRunSchema: ZodTypeAny;
  export const AgentRunRequestSchema: ZodTypeAny;
  export const AgentStreamRequestSchema: ZodTypeAny;
  export const ResearchStreamPayloadSchema: ZodTypeAny;

  export type CitationDocument = Record<string, unknown>;
  export type CitationsBrowserData = Record<string, unknown>;
  export const CitationsBrowserDataSchema: ZodTypeAny;

  export const CorpusDashboardDataSchema: any;
  export const PolicyConfigurationSchema: any;
  export type CorpusDashboardData = Record<string, unknown>;
  export type PolicyConfiguration = Record<string, unknown>;

  export const HitlQueueDataSchema: ZodTypeAny;
  export type HitlQueueData = Record<string, unknown>;

  export const MattersOverviewSchema: ZodTypeAny;
  export type MattersOverview = Record<string, unknown>;

  export const UploadResponseSchema: ZodTypeAny;

  export const ResearchDeskContextSchema: ZodTypeAny;
  export type ResearchDeskContext = Record<string, unknown>;
  export type ResearchPlan = Record<string, unknown>;
  export type ResearchCitation = Record<string, unknown>;

  export type WorkspaceDesk = Record<string, unknown>;
  export type ProcessNavigatorFlow = Record<string, unknown>;

  export interface VoiceRunRequest {
    transcript: string;
    [key: string]: unknown;
  }
  export interface VoiceCitation {
    id: string;
    label: string;
    href: string;
    snippet: string;
    [key: string]: unknown;
  }
  export interface VoiceRunResponse {
    citations: VoiceCitation[];
    [key: string]: unknown;
  }
  export interface VoiceToolIntent {
    id: string;
    name: string;
    tool: string;
    status: string;
    detail?: string;
    [key: string]: unknown;
  }
  export interface VoiceConsoleContext {
    suggestions: string[];
    quickIntents: VoiceToolIntent[];
    recentSessions: Array<Record<string, unknown>>;
    guardrails: string[];
  }
  export const VoiceRunRequestSchema: ZodTypeAny;
  export const VoiceRunResponseSchema: ZodTypeAny;
  export const VoiceConsoleContextSchema: ZodTypeAny;
  export const VoiceSessionTokenSchema: ZodTypeAny;
  export type VoiceSessionToken = Record<string, unknown>;
}

declare module '@avocat-ai/shared/pwa' {
  export const AgentRunSchema: ZodTypeAny;
  export const AgentRunRequestSchema: ZodTypeAny;
  export const AgentStreamRequestSchema: ZodTypeAny;
  export const ResearchStreamPayloadSchema: ZodTypeAny;
  export const UploadResponseSchema: ZodTypeAny;
  export const VoiceRunRequestSchema: ZodTypeAny;
  export const VoiceSessionTokenSchema: ZodTypeAny;
  export type ResearchStreamPayload = Record<string, unknown>;
  export type VoiceRunRequest = Record<string, unknown>;
  export type VoiceSessionToken = Record<string, unknown>;
}

declare module '@avocat-ai/supabase' {
  export function createServiceClient(env: SupabaseEnv): SupabaseServiceClient;
  export type ServiceSupabaseClient = SupabaseServiceClient;
}

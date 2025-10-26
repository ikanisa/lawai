import type { ZodTypeAny } from 'zod';
import type { SupabaseServiceClient } from './supabase.js';

declare module '@avocat-ai/shared' {
  export type OpenAIClientConfig = Record<string, unknown>;
  export function getOpenAIClient(config?: OpenAIClientConfig): unknown;
  export function isOpenAIDebugEnabled(): boolean;
  export async function fetchOpenAIDebugDetails(client: any, error: unknown): Promise<any>;
  export type OrgConnectorRecord = any;
  export const AgentRunSchema: any;
  export const AgentRunRequestSchema: any;
  export const AgentStreamRequestSchema: any;
  export const ResearchStreamPayloadSchema: any;
  export const ResearchDeskContextSchema: any;
  export const CorpusDashboardDataSchema: any;
  export type CorpusDashboardData = any;
  export const CitationsBrowserDataSchema: any;
  export type CitationDocument = any;
  export type CitationsBrowserData = any;
  export const MattersOverviewSchema: any;
  export type MattersOverview = any;
  export const HitlQueueDataSchema: any;
  export type HitlQueueData = any;
  export const PolicyConfigurationSchema: any;
  export type PolicyConfiguration = any;
  export const UploadResponseSchema: any;
  export const VoiceConsoleContextSchema: any;
  export const VoiceRunRequestSchema: any;
  export const VoiceRunResponseSchema: any;
  export const VoiceSessionTokenSchema: any;
  export type VoiceSessionToken = any;
  export type AgentRun = any;
  export type ResearchStreamEvent = any;
  export type ResearchDeskContext = any;
  export type ResearchPlan = any;
  export type ResearchCitation = any;
  export type VoiceConsoleContext = any;
  export type VoiceRunRequest = any;
  export type VoiceRunResponse = any;
  export type VoiceToolIntent = any;
  export type ProcessNavigatorFlow = any;
  export type WorkspaceDesk = any;
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
  export interface SupabaseEnv {
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
  }

  export type ServiceSupabaseClient = SupabaseServiceClient;

  export function createServiceClient(env: SupabaseEnv): ServiceSupabaseClient;
}


declare module '@avocat-ai/shared' {
  export type OpenAIClientConfig = any;
  export function getOpenAIClient(config: OpenAIClientConfig): any;
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
  export const AgentRunSchema: any;
  export const AgentRunRequestSchema: any;
  export const AgentStreamRequestSchema: any;
  export type ResearchStreamPayload = any;
  export const UploadResponseSchema: any;
  export const VoiceRunRequestSchema: any;
  export const VoiceSessionTokenSchema: any;
}

declare module '@avocat-ai/supabase' {
  export function createServiceClient(env: { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string }): any;
}


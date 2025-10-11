declare module '@avocat-ai/shared' {
  export type OpenAIClientConfig = any;
  export function getOpenAIClient(config: OpenAIClientConfig): any;
  export function isOpenAIDebugEnabled(): boolean;
  export async function fetchOpenAIDebugDetails(client: any, error: unknown): Promise<any>;
  export type OrgConnectorRecord = any;
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


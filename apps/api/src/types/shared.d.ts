declare module '@avocat-ai/shared' {
  export type WorkspaceDesk = any;
  export type OpenAIClientConfig = any;
  export function getOpenAIClient(config?: OpenAIClientConfig): any;
  export function isOpenAIDebugEnabled(): boolean;
  export function fetchOpenAIDebugDetails(client: any, error: unknown): Promise<any>;
  // Orchestrator types (temporary shims)
  export type ConnectorStatus = any;
  export type ConnectorType = any;
  export type DirectorCommandInput = any;
  export type OrchestratorCommandEnvelope = any;
  export type OrchestratorCommandRecord = any;
  export type OrchestratorCommandResponse = any;
  export type OrchestratorJobRecord = any;
  export type OrchestratorSessionRecord = any;
  export type OrgConnectorRecord = any;
  export type SafetyAssessmentResult = any;
  // Agent types (temporary shims)
  export type AgentPlanNotice = any;
  export type AgentPlanStep = any;
  export type IRACPayload = any;
  export type IRACSchema = any;
  export const OFFICIAL_DOMAIN_ALLOWLIST: string[];
}

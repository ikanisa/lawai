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

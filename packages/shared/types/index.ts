export type FeatureFlag =
  | "FEAT_AGENT_SHELL"
  | "FEAT_VOICE_REALTIME"
  | "DRIVE_INGESTION_ENABLED";

export interface AgentRunSummary {
  id: string;
  orgId: string;
  agentId: string;
  createdAt: string;
  jurisdiction: string;
  citationPrecision: number;
  temporalValidity: number;
}

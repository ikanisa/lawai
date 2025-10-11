import type { ConnectorType } from './orchestrator.js';

export type FinanceDomainAgentKey =
  | 'tax_compliance'
  | 'accounts_payable'
  | 'audit_assurance'
  | 'cfo_strategy'
  | 'risk_controls'
  | 'regulatory_filings';

export type CapabilityToolType = 'mcp' | 'http' | 'function' | 'supabase' | 'openai' | 'analytics';

export interface CapabilityTool {
  id: string;
  type: CapabilityToolType;
  summary: string;
  docsUrl?: string;
  scopes?: string[];
  entryPoint?: string;
  requiresConnector?: boolean;
}

export interface ConnectorRequirement {
  type: ConnectorType;
  name: string;
  optional?: boolean;
  purpose: string;
}

export interface DatasetDependency {
  id: string;
  description: string;
  residency?: 'eu' | 'ca' | 'ohada' | 'global';
  vectorStoreEnv?: string;
}

export interface GuardrailRequirement {
  id: string;
  description: string;
  policyTag: string;
}

export interface DomainAgentCapability {
  key: FinanceDomainAgentKey;
  displayName: string;
  description: string;
  instructions: string;
  tools: CapabilityTool[];
  datasets: DatasetDependency[];
  connectors: ConnectorRequirement[];
  guardrails: GuardrailRequirement[];
  telemetry: string[];
  hitlPolicies: string[];
}

export interface DirectorCapabilityProfile {
  instructions: string;
  safetyEscalationPolicy: string;
  defaultWorker: 'director';
  supportsRealtime: boolean;
}

export interface FinanceCapabilityManifest {
  version: string;
  director: DirectorCapabilityProfile;
  domains: DomainAgentCapability[];
}

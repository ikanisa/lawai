export type WorkspaceDeskMode = 'ask' | 'do' | 'review' | 'generate';

export interface WorkspaceDeskPlaybookStep {
  id: string;
  name: string;
  description: string;
  status: 'success' | 'skipped' | 'failed';
  attempts: number;
  detail?: Record<string, unknown> | null;
}

export interface WorkspaceDeskPlaybook {
  id: string;
  title: string;
  persona: string;
  jurisdiction: string;
  mode: WorkspaceDeskMode;
  summary: string;
  regulatoryFocus: string[];
  steps: WorkspaceDeskPlaybookStep[];
  cta: { label: string; question?: string; mode: WorkspaceDeskMode };
}

export interface WorkspaceDeskQuickAction {
  id: string;
  label: string;
  description: string;
  mode: WorkspaceDeskMode;
  action: 'navigate' | 'plan' | 'trust' | 'hitl';
  href?: string;
}

export interface WorkspaceDeskPersona {
  id: string;
  label: string;
  description: string;
  mode: WorkspaceDeskMode;
  focusAreas: string[];
  guardrails: string[];
  href: string;
  agentCode: string;
}

export interface WorkspaceDeskToolChip {
  id: string;
  label: string;
  mode: WorkspaceDeskMode;
  status: 'ready' | 'monitoring' | 'requires_hitl';
  description: string;
  action: 'navigate' | 'plan' | 'trust' | 'hitl';
  href?: string;
  ctaLabel: string;
}

export interface WorkspaceDesk {
  playbooks: WorkspaceDeskPlaybook[];
  quickActions: WorkspaceDeskQuickAction[];
  personas: WorkspaceDeskPersona[];
  toolChips: WorkspaceDeskToolChip[];
}

export type ProcessNavigatorStepState = 'complete' | 'in_progress' | 'blocked';

export interface ProcessNavigatorStep {
  id: string;
  label: string;
  description: string;
  state: ProcessNavigatorStepState;
  guardrails: string[];
  outputs: string[];
  escalation?: string | null;
}

export interface ProcessNavigatorTelemetry {
  runCount: number;
  hitlEscalations: number;
  pendingTasks: number;
}

export interface ProcessNavigatorFlow {
  id: string;
  title: string;
  jurisdiction: string;
  persona: string;
  mode: WorkspaceDeskMode;
  summary: string;
  estimatedMinutes: number;
  lastRunAt: string | null;
  alerts: string[];
  telemetry: ProcessNavigatorTelemetry;
  steps: ProcessNavigatorStep[];
}

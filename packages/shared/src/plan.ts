export type AgentPlanStatus = 'success' | 'skipped' | 'failed';

export interface AgentPlanStep {
  id: string;
  name: string;
  description: string;
  startedAt: string;
  finishedAt: string;
  status: AgentPlanStatus;
  attempts: number;
  detail?: Record<string, unknown> | null;
}

export type AgentPlanNoticeType = 'residency' | 'ohada' | 'confidential';

export interface AgentPlanNotice {
  type: AgentPlanNoticeType;
  message: string;
}

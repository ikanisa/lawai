import type { ResearchRiskLevel } from '../pwa.js';
export type PlanDrawerStepStatus = 'pending' | 'active' | 'done' | 'success' | 'skipped' | 'failed';
export interface PlanDrawerNotice {
    id: string;
    message: string;
    tone?: 'info' | 'success' | 'warning' | 'danger';
}
export interface PlanDrawerStepMetadata {
    label: string;
    value: string;
}
export interface PlanDrawerStep {
    id: string;
    title: string;
    status: PlanDrawerStepStatus;
    summary?: string;
    tool?: string;
    metadata?: PlanDrawerStepMetadata[];
    detail?: string;
}
export type PlanDrawerToolLogStatus = 'pending' | 'running' | 'success' | 'error' | 'info';
export interface PlanDrawerToolLogEntry {
    id: string;
    name: string;
    status?: PlanDrawerToolLogStatus;
    description?: string;
    timestamp?: string;
    detail?: string;
    input?: string;
    output?: string;
}
export interface PlanDrawerRisk {
    level?: ResearchRiskLevel | string;
    summary?: string;
    label?: string;
}
export interface PlanDrawerPlan {
    id: string;
    title: string;
    subtitle?: string;
    jurisdiction?: string;
    risk?: PlanDrawerRisk;
    notices?: PlanDrawerNotice[];
    steps: PlanDrawerStep[];
}
//# sourceMappingURL=plan-drawer.d.ts.map
import type { PlanDrawerRisk, PlanDrawerToolLogStatus } from '@avocat-ai/shared';

export function riskBadgeVariant(level: PlanDrawerRisk['level']) {
  switch (level) {
    case 'LOW':
      return 'bg-emerald-500/20 text-emerald-200';
    case 'MED':
      return 'bg-amber-500/20 text-amber-200';
    case 'HIGH':
      return 'bg-red-500/20 text-red-200';
    default:
      return 'bg-slate-500/20 text-slate-100';
  }
}

export function toolStatusBadgeVariant(status: PlanDrawerToolLogStatus | undefined) {
  switch (status) {
    case 'running':
      return 'bg-sky-500/20 text-sky-200';
    case 'success':
      return 'bg-emerald-500/20 text-emerald-200';
    case 'error':
      return 'bg-red-500/20 text-red-200';
    case 'pending':
      return 'bg-amber-500/20 text-amber-200';
    default:
      return 'bg-slate-500/20 text-slate-100';
  }
}

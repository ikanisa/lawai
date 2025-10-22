'use client';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import type { Messages } from '../../lib/i18n';
import type {
  HitlMetricsResponse,
  RetrievalMetricsResponse,
  EvaluationMetricsResponse,
} from '../../lib/api';

interface ComplianceDashboardCardProps {
  messages: Messages['trust']['compliance'];
  hitl: HitlMetricsResponse | undefined;
  retrieval: RetrievalMetricsResponse | undefined;
  evaluation: EvaluationMetricsResponse | undefined;
  loading: boolean;
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '—';
  }
  return `${Math.round(value * 1000) / 10}%`;
}

function resolveStatus(
  value: number | null | undefined,
  thresholds: { good: number; warning: number },
): 'good' | 'warning' | 'critical' | 'unknown' {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'unknown';
  }
  if (value >= thresholds.good) {
    return 'good';
  }
  if (value >= thresholds.warning) {
    return 'warning';
  }
  return 'critical';
}

const statusStyles: Record<'good' | 'warning' | 'critical' | 'unknown', string> = {
  good: 'bg-emerald-500/10 text-emerald-300',
  warning: 'bg-amber-500/10 text-amber-300',
  critical: 'bg-rose-500/10 text-rose-300',
  unknown: 'bg-slate-700/40 text-slate-300',
};

export function ComplianceDashboardCard({ messages, hitl, retrieval, evaluation, loading }: ComplianceDashboardCardProps) {
  const drift = hitl?.metrics.drift ?? null;
  const hitlCoverage =
    drift && drift.highRiskRuns && drift.highRiskRuns > 0
      ? Math.min(1, Math.max(0, drift.hitlEscalations / drift.highRiskRuns))
      : null;
  const allowlistRatio = retrieval?.summary?.allowlistedRatio ?? null;
  const maghrebCoverage = evaluation?.summary?.maghrebBannerCoverage ?? null;

  const metrics = [
    {
      key: 'hitl',
      label: messages.metrics.hitlCoverage,
      description: messages.metrics.hitlDescription,
      value: hitlCoverage,
      thresholds: { good: 0.95, warning: 0.8 },
    },
    {
      key: 'allowlist',
      label: messages.metrics.allowlistHealth,
      description: messages.metrics.allowlistDescription,
      value: allowlistRatio,
      thresholds: { good: 0.95, warning: 0.85 },
    },
    {
      key: 'maghreb',
      label: messages.metrics.maghrebBanner,
      description: messages.metrics.maghrebDescription,
      value: maghrebCoverage,
      thresholds: { good: 0.98, warning: 0.9 },
    },
  ] as const;

  return (
    <Card className="glass-card border border-slate-800/60">
      <CardHeader>
        <CardTitle className="text-slate-100">{messages.title}</CardTitle>
        <p className="text-sm text-slate-400">{messages.description}</p>
      </CardHeader>
      <CardContent>
        {loading && !hitl && !retrieval && !evaluation ? (
          <p className="text-sm text-slate-400">{messages.loading}</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {metrics.map((metric) => {
              const status = resolveStatus(metric.value, metric.thresholds);
              const badgeLabel =
                status === 'unknown'
                  ? messages.notAvailable
                  : messages.status[status as keyof typeof messages.status];
              return (
                <div key={metric.key} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-200">{metric.label}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status]}`}>{badgeLabel}</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-100">{formatPercent(metric.value)}</p>
                  <p className="mt-2 text-sm text-slate-400">{metric.description}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

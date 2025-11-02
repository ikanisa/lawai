import type { ReactNode } from 'react';
import { useMemo } from 'react';

import type { GovernanceMetricsResponse } from '@/lib/api';
import type { Messages } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';

import {
  decimalFormatter,
  formatDateTime,
  formatMinutes,
  formatPercent,
  numberFormatter,
} from '../utils/formatters';

export interface AdminTelemetryDashboardProps {
  messages: Messages['admin'];
  overview: GovernanceMetricsResponse['overview'] | null;
  manifest: GovernanceMetricsResponse['manifest'] | null;
  loading: boolean;
  thresholds: {
    runsHigh: number;
    runsMedium: number;
  };
}

export function AdminTelemetryDashboard({
  messages,
  overview,
  manifest,
  loading,
  thresholds,
}: AdminTelemetryDashboardProps) {
  const summaryPrimary = useMemo(() => {
    if (!overview) return '—';
    if (overview.documentsTotal === 0) {
      return messages.summaryCoverageEmpty;
    }
    return `${numberFormatter.format(overview.documentsReady)} / ${numberFormatter.format(overview.documentsTotal)}`;
  }, [overview, messages.summaryCoverageEmpty]);

  const summarySecondary = useMemo(() => {
    if (!overview) return messages.summaryCoverageHint;
    const pendingNum = overview.documentsPending ?? 0;
    const failedNum = overview.documentsFailed ?? 0;
    const statusKind = failedNum > 0 ? 'error' : pendingNum > 0 ? 'warning' : 'ok';
    const statusLabel =
      statusKind === 'error'
        ? messages.summaryStatusErrors
        : statusKind === 'warning'
          ? messages.summaryStatusPending
          : messages.summaryStatusOk;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge =
      statusKind === 'error'
        ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
        : statusKind === 'warning'
          ? 'bg-amber-900/40 text-amber-200 border-amber-700/50'
          : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';

    const pending = numberFormatter.format(pendingNum);
    const failed = numberFormatter.format(failedNum);
    const skipped = numberFormatter.format(overview.documentsSkipped);
    const chunked = numberFormatter.format(overview.documentsChunked);
    return (
      <span>
        <span className={`${baseBadge} ${colorBadge}`}>{statusLabel}</span>
        <span className="mx-1 text-slate-600">·</span>
        <span>
          {messages.summaryPendingLabel} {pending} · {messages.summaryFailedLabel} {failed} · {messages.summarySkippedLabel} {skipped} · {messages.summaryChunkedLabel} {chunked}
        </span>
      </span>
    );
  }, [
    overview,
    messages.summaryCoverageHint,
    messages.summaryStatusErrors,
    messages.summaryStatusPending,
    messages.summaryStatusOk,
    messages.summaryPendingLabel,
    messages.summaryFailedLabel,
    messages.summarySkippedLabel,
    messages.summaryChunkedLabel,
  ]);

  const ingestionSummary = useMemo(() => {
    if (!overview) return '—';
    return `${overview.ingestionSuccessLast7Days} ${messages.ingestionSuccessLabel} · ${overview.ingestionFailedLast7Days} ${messages.ingestionFailureLabel}`;
  }, [overview, messages.ingestionSuccessLabel, messages.ingestionFailureLabel]);

  const ingestionSecondary = useMemo(() => {
    if (!overview) return messages.ingestionHint;
    const kind = overview.ingestionFailedLast7Days > 0 ? 'error' : 'ok';
    const label = kind === 'error' ? messages.ingestionStatusFailures : messages.ingestionStatusOk;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge =
      kind === 'error'
        ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
        : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';
    return (
      <span>
        <span
          className={`${baseBadge} ${colorBadge}`}
          title={`Success ${overview.ingestionSuccessLast7Days} · Failures ${overview.ingestionFailedLast7Days}`}
        >
          {label}
        </span>
        <span className="mx-1 text-slate-600">·</span>
        <span>{messages.ingestionHint}</span>
      </span>
    );
  }, [overview, messages.ingestionHint, messages.ingestionStatusFailures, messages.ingestionStatusOk]);

  const hitlSecondary = useMemo(() => {
    if (!overview) return `${messages.hitlMedianResponse} ${formatMinutes(null)}`;
    const hasBacklog = (overview.hitlPending ?? 0) > 0;
    const label = hasBacklog ? messages.hitlStatusBacklog : messages.hitlStatusOk;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge = hasBacklog
      ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
      : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';
    return (
      <span>
        <span
          className={`${baseBadge} ${colorBadge}`}
          title={`Pending ${overview.hitlPending} · Median ${formatMinutes(overview.hitlMedianResponseMinutes)}`}
        >
          {label}
        </span>
        <span className="mx-1 text-slate-600">·</span>
        <span>
          {messages.hitlMedianResponse} {formatMinutes(overview.hitlMedianResponseMinutes)}
        </span>
      </span>
    );
  }, [overview, messages.hitlStatusBacklog, messages.hitlStatusOk, messages.hitlMedianResponse]);

  const highRiskSecondary = useMemo(() => {
    const count = overview?.highRiskRuns ?? 0;
    const kind = count > 0 ? 'warning' : 'ok';
    const label = kind === 'ok' ? messages.highRiskStatusOk : messages.highRiskStatusPresent;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge =
      kind === 'ok'
        ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50'
        : 'bg-amber-900/40 text-amber-200 border-amber-700/50';

    const ratio = overview?.allowlistedCitationRatio ?? null;
    let allowlistedKind: 'good' | 'ok' | 'low' | null = null;
    if (typeof ratio === 'number') {
      allowlistedKind = ratio >= 0.95 ? 'good' : ratio >= 0.9 ? 'ok' : 'low';
    }
    const allowlistedLabel =
      allowlistedKind === 'good'
        ? messages.allowlistedStatusGood
        : allowlistedKind === 'ok'
          ? messages.allowlistedStatusAcceptable
          : allowlistedKind === 'low'
            ? messages.allowlistedStatusPoor
            : null;
    const allowlistedColor =
      allowlistedKind === 'good'
        ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50'
        : allowlistedKind === 'ok'
          ? 'bg-amber-900/40 text-amber-200 border-amber-700/50'
          : allowlistedKind === 'low'
            ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
            : null;
    return (
      <span>
        {allowlistedLabel && allowlistedColor ? (
          <>
            <span
              className={`${baseBadge} ${allowlistedColor}`}
              title={`Allowlisted precision ${formatPercent(overview?.allowlistedCitationRatio)} (≥95% good, ≥90% acceptable)`}
            >
              {allowlistedLabel}
            </span>
            <span className="mx-1 text-slate-600">·</span>
          </>
        ) : null}
        <span
          className={`${baseBadge} ${colorBadge}`}
          title={`${messages.highRiskRunsLabel}: ${overview ? numberFormatter.format(count) : '—'}`}
        >
          {label}
        </span>
        <span className="mx-1 text-slate-600">·</span>
        <span>
          {messages.highRiskRunsLabel} {overview ? numberFormatter.format(count) : '—'}
        </span>
      </span>
    );
  }, [
    overview,
    messages.allowlistedStatusGood,
    messages.allowlistedStatusAcceptable,
    messages.allowlistedStatusPoor,
    messages.highRiskStatusOk,
    messages.highRiskStatusPresent,
    messages.highRiskRunsLabel,
  ]);

  const confidentialSecondary = useMemo(() => {
    const count = overview?.confidentialRuns ?? 0;
    const active = count > 0;
    const label = active ? messages.confidentialStatusActive : messages.confidentialStatusNone;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge = active
      ? 'bg-sky-900/40 text-sky-200 border-sky-700/50'
      : 'bg-slate-800/40 text-slate-300 border-slate-700/50';
    return (
      <span>
        <span className={`${baseBadge} ${colorBadge}`} title={`Confidential runs: ${numberFormatter.format(count)}`}>
          {label}
        </span>
        <span className="mx-1 text-slate-600">·</span>
        <span>
          {messages.avgLatency} {overview ? decimalFormatter.format(overview.avgLatencyMs) : '—'} ms
        </span>
      </span>
    );
  }, [overview, messages.confidentialStatusActive, messages.confidentialStatusNone, messages.avgLatency]);

  const manifestStatus = useMemo(() => {
    if (!manifest) return null;
    const status = manifest.status ?? null;
    if (status === 'errors') return messages.manifestStatusErrors;
    if (status === 'warnings') return messages.manifestStatusWarnings;
    if (status === 'ok') return messages.manifestStatusOk;
    if (manifest.errorCount > 0) return messages.manifestStatusErrors;
    if (manifest.warningCount > 0) return messages.manifestStatusWarnings;
    return messages.manifestStatusOk;
  }, [manifest, messages.manifestStatusErrors, messages.manifestStatusWarnings, messages.manifestStatusOk]);

  const manifestPrimary = useMemo(() => {
    if (!manifest) return '—';
    return `${numberFormatter.format(manifest.validCount)} / ${numberFormatter.format(manifest.fileCount)} · ${numberFormatter.format(manifest.warningCount)} ${messages.manifestWarningsLabel} · ${numberFormatter.format(manifest.errorCount)} ${messages.manifestErrorsLabel}`;
  }, [manifest, messages.manifestWarningsLabel, messages.manifestErrorsLabel]);

  const manifestSecondary = useMemo(() => {
    if (!manifest) return messages.manifestHint;
    const name = manifest.manifestName ?? 'manifest.jsonl';
    const statusLabel = manifestStatus ?? '';
    const statusKind = manifest.status === 'errors' ? 'error' : manifest.status === 'warnings' ? 'warning' : 'ok';
    const baseBadge =
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge =
      statusKind === 'error'
        ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
        : statusKind === 'warning'
          ? 'bg-amber-900/40 text-amber-200 border-amber-700/50'
          : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';
    const badge = statusLabel ? (
      <span
        className={`${baseBadge} ${colorBadge}`}
        title={`Warnings ${manifest.warningCount} · Errors ${manifest.errorCount}`}
      >
        {statusLabel}
      </span>
    ) : null;
    return (
      <span>
        {badge ? (
          <>
            {badge}
            <span className="mx-1 text-slate-600">·</span>
          </>
        ) : null}
        <span>{name}</span>
        <span className="mx-1 text-slate-600">·</span>
        <span>{formatDateTime(manifest.createdAt)}</span>
      </span>
    );
  }, [manifest, manifestStatus, messages.manifestHint]);

  return (
    <Card className="glass-card border border-slate-800/60">
      <CardHeader>
        <CardTitle className="text-slate-100">{messages.metricsTitle}</CardTitle>
        <p className="text-sm text-slate-400">{messages.metricsDescription}</p>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <MetricBlock
          label={messages.runs30d}
          primary={overview ? numberFormatter.format(overview.runsLast30Days) : '—'}
          secondary={(function () {
            const { runsHigh, runsMedium } = thresholds;
            const count = overview?.runsLast30Days ?? 0;
            let kind: 'high' | 'medium' | 'low' = 'low';
            if (count >= runsHigh) kind = 'high';
            else if (count >= runsMedium) kind = 'medium';
            const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
            const { label, color } =
              kind === 'high'
                ? { label: messages.runsStatusHigh, color: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50' }
                : kind === 'medium'
                  ? { label: messages.runsStatusMedium, color: 'bg-amber-900/40 text-amber-200 border-amber-700/50' }
                  : { label: messages.runsStatusLow, color: 'bg-slate-800/40 text-slate-300 border-slate-700/50' };
            return (
              <span>
                <span
                  className={`${baseBadge} ${color}`}
                  title={`Runs(30d): ${numberFormatter.format(count)} (high ≥ ${runsHigh}, medium ≥ ${runsMedium})`}
                >
                  {label}
                </span>
                <span className="mx-1 text-slate-600">·</span>
                <span>
                  {messages.totalRunsLabel} {overview ? numberFormatter.format(overview.totalRuns) : '—'}
                </span>
              </span>
            );
          })()}
          loading={loading}
        />
        <MetricBlock
          label={messages.allowlistedPrecision}
          primary={formatPercent(overview?.allowlistedCitationRatio)}
          secondary={highRiskSecondary}
          loading={loading}
        />
        <MetricBlock
          label={messages.hitlPending}
          primary={overview ? numberFormatter.format(overview.hitlPending) : '—'}
          secondary={hitlSecondary}
          loading={loading}
        />
        <MetricBlock
          label={messages.confidentialUsage}
          primary={overview ? numberFormatter.format(overview.confidentialRuns) : '—'}
          secondary={confidentialSecondary}
          loading={loading}
        />
        <MetricBlock
          label={messages.summaryCoverage}
          primary={summaryPrimary}
          secondary={summarySecondary}
          loading={loading}
        />
        <MetricBlock
          label={messages.ingestionHealth}
          primary={ingestionSummary}
          secondary={ingestionSecondary}
          loading={loading}
        />
        <MetricBlock
          label={messages.manifestStatus}
          primary={manifestPrimary}
          secondary={manifestSecondary}
          loading={loading}
        />
      </CardContent>
    </Card>
  );
}

interface MetricBlockProps {
  label: string;
  primary: string;
  secondary?: ReactNode;
  loading?: boolean;
}

function MetricBlock({ label, primary, secondary, loading }: MetricBlockProps) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4 shadow-inner">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{loading ? '…' : primary}</p>
      {secondary ? <p className="mt-1 text-xs text-slate-500">{secondary}</p> : null}
    </div>
  );
}

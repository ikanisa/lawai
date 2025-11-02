'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@avocat-ai/ui';
import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';
import { Textarea } from '@avocat-ai/ui';
import { Badge } from '@avocat-ai/ui';
import type { Locale, Messages } from '@/lib/i18n';
import {
  DEMO_ORG_ID,
  fetchHitlAuditTrail,
  fetchHitlDetail,
  fetchHitlMetrics,
  fetchHitlQueue,
  submitHitlAction,
  type AuditEvent,
  type HitlDetailResponse,
} from '@/lib/api';

interface HitlViewProps {
  messages: Messages;
  locale: Locale;
}

interface QueueItem {
  id: string;
  runId: string | null;
  reason: string;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  resolutionMinutes?: number | null;
  resolutionBucket?: string | null;
  reviewerComment?: string | null;
}

interface HitlCitation {
  title?: string | null;
  publisher?: string | null;
  url: string;
  note?: string | null;
  domainOk?: boolean | null;
}

const EMPTY_QUEUE: QueueItem[] = [];

const AUDIT_LABELS: Record<string, (messages: Messages) => string> = {
  'hitl.action': (messages) => messages.hitl.timelineActionLabel,
};

const RISK_VARIANTS: Record<
  string,
  { tone: 'success' | 'warning' | 'danger'; label: (messages: Messages) => string }
> = {
  LOW: {
    tone: 'success',
    label: (messages) => messages.research.riskLow,
  },
  MEDIUM: {
    tone: 'warning',
    label: (messages) => messages.research.riskMedium,
  },
  HIGH: {
    tone: 'danger',
    label: (messages) => messages.research.riskHigh,
  },
};

function formatDateTime(value: string | null | undefined, locale: Locale): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function getAuditLabel(kind: string, messages: Messages): string {
  const resolver = AUDIT_LABELS[kind];
  return resolver ? resolver(messages) : kind;
}

function describeAuditEvent(event: AuditEvent, messages: Messages, parseNumber: (value: unknown) => number | null): string {
  const metadata = (event.metadata ?? {}) as Record<string, unknown>;
  const segments: string[] = [];
  const status = typeof metadata.status === 'string' ? metadata.status : null;
  if (status) {
    segments.push(messages.hitl.timelineActionStatus.replace('{status}', status));
  }
  const minutes = parseNumber(metadata.resolution_minutes ?? metadata.resolutionMinutes);
  if (minutes !== null) {
    segments.push(messages.hitl.timelineActionMinutes.replace('{minutes}', minutes.toString()));
  }
  const comment = typeof metadata.comment === 'string' ? metadata.comment.trim() : '';
  if (comment) {
    segments.push(messages.hitl.timelineComment.replace('{comment}', comment));
  } else if (segments.length > 0) {
    segments.push(messages.hitl.timelineNoComment);
  }
  return segments.join(' · ');
}

export function HitlView({ messages, locale }: HitlViewProps) {
  const [selectedHitlId, setSelectedHitlId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const queueQuery = useQuery({ queryKey: ['hitl'], queryFn: () => fetchHitlQueue(DEMO_ORG_ID) });
  const detailQuery = useQuery<HitlDetailResponse>({
    queryKey: ['hitl-detail', selectedHitlId],
    enabled: Boolean(selectedHitlId),
    queryFn: () => fetchHitlDetail(DEMO_ORG_ID, selectedHitlId ?? ''),
  });
  const metricsQuery = useQuery({
    queryKey: ['hitl-metrics'],
    queryFn: () => fetchHitlMetrics(DEMO_ORG_ID),
  });

  const actionMutation = useMutation({
    mutationFn: (input: { id: string; action: 'approve' | 'request_changes' | 'reject'; comment?: string }) =>
      submitHitlAction(input.id, input.action, input.comment),
    onSuccess: () => {
      toast.success(locale === 'fr' ? 'Revue enregistrée' : 'Review saved');
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['hitl'] });
      queryClient.invalidateQueries({ queryKey: ['hitl-detail'] });
      queryClient.invalidateQueries({ queryKey: ['hitl-audit'] });
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Échec de la revue' : 'Review failed');
    },
  });

  const queue = (queueQuery.data?.items as QueueItem[] | undefined) ?? EMPTY_QUEUE;
  const selectedItem = useMemo(() => queue.find((item) => item.id === selectedHitlId) ?? null, [queue, selectedHitlId]);

  useEffect(() => {
    if (!selectedHitlId && queue.length > 0) {
      setSelectedHitlId(queue[0].id);
    }
  }, [selectedHitlId, queue]);

  const auditQuery = useQuery({
    queryKey: ['hitl-audit', selectedItem?.runId ?? null, selectedHitlId],
    enabled: Boolean(selectedHitlId),
    queryFn: () =>
      fetchHitlAuditTrail(DEMO_ORG_ID, {
        objectId: selectedHitlId ?? undefined,
        runId: selectedItem?.runId ?? undefined,
        limit: 50,
      }),
  });

  const detail = detailQuery.data;
  const run = detail?.run ?? null;
  const runRiskVariant =
    run?.riskLevel && run.riskLevel in RISK_VARIANTS
      ? RISK_VARIANTS[run.riskLevel as keyof typeof RISK_VARIANTS]
      : null;
  const citations = (detail?.citations ?? []) as HitlCitation[];
  const auditEvents = (auditQuery.data?.events ?? []) as AuditEvent[];
  const metrics = metricsQuery.data?.metrics;
  const fairness = metrics?.fairness;
  const flaggedJurisdictions = fairness?.flagged?.jurisdictions ?? [];
  const flaggedBenchmarks = fairness?.flagged?.benchmarks ?? [];
  const queueBreakdown = metrics?.queue?.byType ?? {};
  const hasQueueBreakdown = Object.keys(queueBreakdown).length > 0;

  const parseNumber = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const fairnessOverall =
    fairness && fairness.overall && typeof fairness.overall === 'object' ? fairness.overall : null;
  const fairnessTotalRuns = fairnessOverall ? parseNumber((fairnessOverall as Record<string, unknown>).totalRuns) : null;
  const fairnessHitlRate = fairnessOverall ? parseNumber((fairnessOverall as Record<string, unknown>).hitlRate) : null;
  const fairnessHighRiskShare =
    fairnessOverall ? parseNumber((fairnessOverall as Record<string, unknown>).highRiskShare) : null;
  const fairnessBenchmarkRate =
    fairnessOverall ? parseNumber((fairnessOverall as Record<string, unknown>).benchmarkRate) : null;
  const fairnessJurisdictions = Array.isArray(fairness?.jurisdictions)
    ? (fairness.jurisdictions as Array<Record<string, unknown>>)
    : [];
  const fairnessTrend = Array.isArray(fairness?.trend)
    ? (fairness.trend as Array<Record<string, unknown>>)
    : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[340px,1fr]">
      <aside className="space-y-3">
        {queue.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedHitlId(item.id)}
            className={`focus-ring w-full rounded-3xl border px-4 py-3 text-left transition ${
              selectedHitlId === item.id
                ? 'border-legal-amber/80 bg-legal-amber/10 text-amber-100'
                : 'border-slate-800/60 bg-slate-900/60 text-slate-200 hover:border-legal-amber/60'
            }`}
          >
            <p className="text-sm font-semibold">{item.reason}</p>
            <p className="text-xs text-slate-400">
              {messages.hitl.submitted}: {formatDateTime(item.createdAt ?? null, locale)}
            </p>
            <Badge variant={item.status === 'pending' ? 'warning' : 'outline'} className="mt-2">
              {item.status}
            </Badge>
          </button>
        ))}
        {queue.length === 0 ? <p className="text-sm text-slate-500">{messages.hitl.empty}</p> : null}
      </aside>
      <section className="space-y-5">
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.hitl.title}</CardTitle>
            <p className="text-sm text-slate-400">{messages.hitl.auditTrail}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            {run ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{run.question}</p>
                  <p className="text-xs text-slate-400">
                    {run.jurisdiction
                      ? messages.hitl.jurisdictionLabel.replace('{jurisdiction}', run.jurisdiction)
                      : messages.hitl.jurisdictionUnknown}
                  </p>
                  <p className="text-xs text-slate-500">
                    {messages.hitl.submitted}: {formatDateTime(run.startedAt ?? run.finishedAt ?? null, locale)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  {runRiskVariant ? (
                    <Badge variant={runRiskVariant.tone}>{runRiskVariant.label(messages)}</Badge>
                  ) : null}
                  {run.status ? <Badge variant="outline">{run.status}</Badge> : null}
                </div>
              </div>
            ) : (
              <p>{messages.hitl.empty}</p>
            )}
            <div className="space-y-2">
              {citations.map((citation) => (
                <div key={citation.url} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-sm font-semibold text-slate-100">{citation.title ?? citation.url}</p>
                  <p className="text-xs text-slate-400">{citation.publisher ?? '—'}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {typeof citation.domainOk === 'boolean' ? (
                      <Badge variant={citation.domainOk ? 'success' : 'warning'}>
                        {citation.domainOk
                          ? messages.hitl.citationAllowlisted
                          : messages.hitl.citationUnverified}
                      </Badge>
                    ) : null}
                    {citation.note ? <Badge variant="outline">{citation.note}</Badge> : null}
                  </div>
                </div>
              ))}
              {citations.length === 0 ? (
                <p className="text-xs text-slate-500">{messages.hitl.noCitations}</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.hitl.review}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder={messages.hitl.comment} />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={!selectedHitlId || actionMutation.isPending}
                onClick={() => selectedHitlId && actionMutation.mutate({ id: selectedHitlId, action: 'approve', comment })}
              >
                {messages.hitl.approve}
              </Button>
              <Button
                variant="outline"
                disabled={!selectedHitlId || actionMutation.isPending}
                onClick={() => selectedHitlId && actionMutation.mutate({ id: selectedHitlId, action: 'request_changes', comment })}
              >
                {messages.hitl.requestChanges}
              </Button>
              <Button
                variant="outline"
                disabled={!selectedHitlId || actionMutation.isPending}
                onClick={() => selectedHitlId && actionMutation.mutate({ id: selectedHitlId, action: 'reject', comment })}
              >
                {messages.hitl.reject}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.hitl.timelineTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.hitl.timelineSubtitle}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {auditQuery.isLoading ? (
              <p className="text-slate-400">{messages.hitl.timelineLoading}</p>
            ) : auditEvents.length === 0 ? (
              <p className="text-slate-400">{messages.hitl.timelineEmpty}</p>
            ) : (
              <ol className="space-y-3">
                {auditEvents.map((event) => {
                  const description = describeAuditEvent(event, messages, parseNumber) || messages.hitl.timelineUnknown;
                  const actor =
                    event.actor_user_id && event.actor_user_id.length > 0
                      ? messages.hitl.timelineActor.replace('{actor}', event.actor_user_id)
                      : null;
                  return (
                    <li key={event.id} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline">{getAuditLabel(event.kind, messages)}</Badge>
                        <span className="text-xs text-slate-400">
                          {formatDateTime(event.created_at ?? null, locale)}
                        </span>
                      </div>
                      {description ? <p className="mt-2 text-sm text-slate-200">{description}</p> : null}
                      {actor ? <p className="mt-1 text-xs text-slate-500">{actor}</p> : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.hitl.metricsTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.hitl.metricsSubtitle}</p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {metricsQuery.isLoading ? (
              <p className="text-slate-400">{messages.hitl.metricsLoading}</p>
            ) : metrics ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {messages.hitl.metricsQueueLabel}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-slate-200">
                    <span>{messages.hitl.metricsQueuePending}</span>
                    <span className="font-semibold">{metrics.queue?.pending ?? '—'}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-slate-400">
                    <span>{messages.hitl.metricsQueueOldest}</span>
                    <span>{metrics.queue?.oldestCreatedAt ?? '—'}</span>
                  </div>
                  {hasQueueBreakdown ? (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs text-slate-400">{messages.hitl.metricsQueueBreakdown}</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(queueBreakdown).map(([type, count]) => (
                          <Badge key={type} variant="outline" className="gap-1 text-xs">
                            <span className="font-semibold text-slate-100">{count ?? 0}</span>
                            <span className="uppercase tracking-wide text-slate-400">
                              {type.replace(/_/g, ' ')}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {messages.hitl.metricsDriftLabel}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-slate-200">
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsRuns24h}</p>
                      <p className="font-semibold">{metrics.drift?.totalRuns ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsEscalations}</p>
                      <p className="font-semibold">{metrics.drift?.hitlEscalations ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsHighRisk}</p>
                      <p className="font-semibold">{metrics.drift?.highRiskRuns ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsAllowlisted}</p>
                      <p className="font-semibold">
                        {metrics.drift?.allowlistedRatio !== null
                          ? `${Math.round((metrics.drift?.allowlistedRatio ?? 0) * 100)}%`
                          : '—'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">
                    {messages.hitl.metricsFairnessLabel}
                  </p>
                  <div className="mt-2 space-y-2">
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsCaptured}</p>
                      <p>{fairness?.capturedAt ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsFairnessOverall}</p>
                      {fairnessTotalRuns !== null || fairnessHitlRate !== null ? (
                        <div className="mt-1 space-y-2 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3">
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>{messages.hitl.metricsFairnessTotalRuns}</span>
                            <span className="font-semibold text-slate-100">{fairnessTotalRuns ?? '—'}</span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-xs text-slate-300">
                              <span>{messages.hitl.metricsFairnessHitlRate}</span>
                              <span className="font-semibold text-slate-100">
                                {fairnessHitlRate !== null ? `${Math.round(Math.min(Math.max(fairnessHitlRate, 0), 1) * 100)}%` : '—'}
                              </span>
                            </div>
                            {fairnessHitlRate !== null ? (
                              <div className="mt-1 h-2 rounded-full bg-slate-800/80" role="presentation">
                                <div
                                  className="h-2 rounded-full bg-legal-amber/80"
                                  style={{ width: `${Math.round(Math.min(Math.max(fairnessHitlRate, 0), 1) * 100)}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>{messages.hitl.metricsFairnessHighRisk}</span>
                            <span className="font-semibold text-slate-100">
                              {fairnessHighRiskShare !== null
                                ? `${Math.round(Math.min(Math.max(fairnessHighRiskShare, 0), 1) * 100)}%`
                                : '—'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-300">
                            <span>{messages.hitl.metricsFairnessBenchmarkRate}</span>
                            <span className="font-semibold text-slate-100">
                              {fairnessBenchmarkRate !== null
                                ? `${Math.round(Math.min(Math.max(fairnessBenchmarkRate, 0), 1) * 100)}%`
                                : '—'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">{messages.hitl.metricsFairnessOverallMissing}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsFairnessFlagged}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {flaggedJurisdictions.length > 0 ? (
                          flaggedJurisdictions.map((code) => (
                            <Badge key={code} variant="outline">
                              {code}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">{messages.hitl.metricsNoneFlagged}</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsBenchmarksFlagged}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {flaggedBenchmarks.length > 0 ? (
                          flaggedBenchmarks.map((name) => (
                            <Badge key={name} variant="outline">
                              {name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">{messages.hitl.metricsBenchmarksNone}</span>
                        )}
                      </div>
                    </div>
                    {fairnessJurisdictions.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-slate-400">{messages.hitl.metricsFairnessJurisdictions}</p>
                        <div className="space-y-2">
                          {fairnessJurisdictions.map((entry) => {
                            const code = typeof entry.code === 'string' ? entry.code : '—';
                            const total = parseNumber(entry.totalRuns) ?? 0;
                            const hitlEscalations = parseNumber(entry.hitlEscalations) ?? 0;
                            const hitlRateValue = parseNumber(entry.hitlRate);
                            const highRiskValue = parseNumber(entry.highRiskShare);
                            const isFlagged = flaggedJurisdictions.includes(code);
                            return (
                              <div
                                key={`${code}-${total}-${hitlEscalations}`}
                                className={`rounded-2xl border p-3 text-xs transition ${
                                  isFlagged
                                    ? 'border-legal-amber/70 bg-legal-amber/10 text-amber-100'
                                    : 'border-slate-800/60 bg-slate-900/60 text-slate-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold uppercase tracking-wide">{code}</span>
                                  <span className="text-slate-400">{messages.hitl.metricsFairnessTotalRuns}: {total}</span>
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
                                  <div>
                                    <p>{messages.hitl.metricsFairnessJurisdictionHitlRate}</p>
                                    <p className="font-semibold text-slate-100">
                                      {hitlRateValue !== null
                                        ? `${Math.round(Math.min(Math.max(hitlRateValue, 0), 1) * 100)}%`
                                        : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p>{messages.hitl.metricsFairnessJurisdictionHighRisk}</p>
                                    <p className="font-semibold text-slate-100">
                                      {highRiskValue !== null
                                        ? `${Math.round(Math.min(Math.max(highRiskValue, 0), 1) * 100)}%`
                                        : '—'}
                                    </p>
                                  </div>
                                </div>
                                <p className="mt-2 text-slate-400">
                                  {messages.hitl.metricsFairnessEscalations.replace(
                                    '{count}',
                                    hitlEscalations.toString(),
                                  )}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-2">
                      <p className="text-xs text-slate-400">{messages.hitl.metricsFairnessTrend}</p>
                      {fairnessTrend.length > 0 ? (
                        <ol className="mt-2 space-y-2">
                          {fairnessTrend.map((entry, index) => {
                            const overall =
                              entry.overall && typeof entry.overall === 'object'
                                ? (entry.overall as Record<string, unknown>)
                                : null;
                            const trendTotal = overall ? parseNumber(overall.totalRuns) : null;
                            const trendHitl = overall ? parseNumber(overall.hitlRate) : null;
                            const trendHighRisk = overall ? parseNumber(overall.highRiskShare) : null;
                            const trendBenchmark = overall ? parseNumber(overall.benchmarkRate) : null;
                            const flagged =
                              entry.flagged && typeof entry.flagged === 'object'
                                ? (entry.flagged as Record<string, unknown>)
                                : null;
                            const flaggedCodes = Array.isArray(flagged?.jurisdictions)
                              ? (flagged?.jurisdictions as unknown[]).filter((code): code is string => typeof code === 'string')
                              : [];
                            const capturedAt = formatDateTime(
                              typeof entry.capturedAt === 'string'
                                ? entry.capturedAt
                                : typeof entry.reportDate === 'string'
                                ? entry.reportDate
                                : null,
                              locale,
                            );
                            const windowStart =
                              typeof entry.windowStart === 'string'
                                ? formatDateTime(entry.windowStart, locale)
                                : null;
                            const windowEnd =
                              typeof entry.windowEnd === 'string'
                                ? formatDateTime(entry.windowEnd, locale)
                                : null;
                            return (
                              <li
                                key={entry.reportDate ?? `${capturedAt}-${index}`}
                                className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-3 text-xs text-slate-200"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-400">
                                  <span>{capturedAt}</span>
                                  {windowStart && windowEnd ? (
                                    <span>
                                      {messages.hitl.metricsFairnessTrendWindow
                                        .replace('{start}', windowStart)
                                        .replace('{end}', windowEnd)}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-slate-300">
                                  <div>
                                    <p>{messages.hitl.metricsFairnessTotalRuns}</p>
                                    <p className="font-semibold text-slate-100">{trendTotal ?? '—'}</p>
                                  </div>
                                  <div>
                                    <p>{messages.hitl.metricsFairnessHitlRate}</p>
                                    <p className="font-semibold text-slate-100">
                                      {trendHitl !== null
                                        ? `${Math.round(Math.min(Math.max(trendHitl, 0), 1) * 100)}%`
                                        : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p>{messages.hitl.metricsFairnessHighRisk}</p>
                                    <p className="font-semibold text-slate-100">
                                      {trendHighRisk !== null
                                        ? `${Math.round(Math.min(Math.max(trendHighRisk, 0), 1) * 100)}%`
                                        : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p>{messages.hitl.metricsFairnessBenchmarkRate}</p>
                                    <p className="font-semibold text-slate-100">
                                      {trendBenchmark !== null
                                        ? `${Math.round(Math.min(Math.max(trendBenchmark, 0), 1) * 100)}%`
                                        : '—'}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2 text-slate-400">
                                  {flaggedCodes.length > 0 ? (
                                    <>
                                      <span>{messages.hitl.metricsFairnessTrendFlagged}</span>
                                      {flaggedCodes.map((code) => (
                                        <Badge key={`${entry.reportDate ?? index}-${code}`} variant="outline">
                                          {code}
                                        </Badge>
                                      ))}
                                    </>
                                  ) : (
                                    <span>{messages.hitl.metricsFairnessTrendNoFlags}</span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">{messages.hitl.metricsFairnessTrendEmpty}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-400">{messages.hitl.metricsNone}</p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

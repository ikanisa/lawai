'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Bell } from 'lucide-react';
import type { Locale, Messages } from '../../lib/i18n';
import { DEMO_ORG_ID, fetchHitlQueue, fetchHitlMetrics, fetchMatterDetail, submitHitlAction } from '../../lib/api';
import { useDigest } from '../../hooks/use-digest';

interface HitlViewProps {
  messages: Messages;
  locale: Locale;
}

interface QueueItem {
  id: string;
  runId: string;
  reason: string;
  status: string;
  createdAt?: string;
}

interface MatterCitation {
  title?: string | null;
  publisher?: string | null;
  url: string;
}

export function HitlView({ messages, locale }: HitlViewProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();
  const { enabled: digestEnabled, enable: enableDigest, loading: digestLoading } = useDigest();

  const queueQuery = useQuery({ queryKey: ['hitl'], queryFn: () => fetchHitlQueue(DEMO_ORG_ID) });
  const detailQuery = useQuery({
    queryKey: ['hitl-detail', selected],
    enabled: Boolean(selected),
    queryFn: () => fetchMatterDetail(DEMO_ORG_ID, selected ?? ''),
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
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Échec de la revue' : 'Review failed');
    },
  });

  const queue = (queueQuery.data?.items ?? []) as QueueItem[];
  const metrics = metricsQuery.data?.metrics;
  const fairness = metrics?.fairness;
  const flaggedJurisdictions = fairness?.flagged?.jurisdictions ?? [];
  const flaggedBenchmarks = fairness?.flagged?.benchmarks ?? [];
  const flaggedSynonyms = fairness?.flagged?.synonyms ?? [];
  const queueBreakdown = metrics?.queue?.byType ?? {};
  const hasQueueBreakdown = Object.keys(queueBreakdown).length > 0;
  const detailResidency = detailQuery.data?.matter?.provenance?.residency ?? [];

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

  async function handleEnableDigest() {
    try {
      const granted = await enableDigest();
      if (granted) {
        toast.success(messages.workspace.digestEnabled);
      } else {
        toast.error(messages.workspace.digestError);
      }
    } catch (error) {
      console.error('digest_enable_failed', error);
      toast.error(messages.workspace.digestError);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[340px,1fr]">
      <aside className="space-y-3">
        {queue.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelected(item.runId)}
            className={`focus-ring w-full rounded-3xl border px-4 py-3 text-left transition ${
              selected === item.runId
                ? 'border-legal-amber/80 bg-legal-amber/10 text-amber-100'
                : 'border-slate-800/60 bg-slate-900/60 text-slate-200 hover:border-legal-amber/60'
            }`}
          >
            <p className="text-sm font-semibold">{item.reason}</p>
            <p className="text-xs text-slate-400">{messages.hitl.submitted}: {item.createdAt ?? '—'}</p>
            <Badge variant={item.status === 'pending' ? 'warning' : 'outline'} className="mt-2">
              {item.status}
            </Badge>
          </button>
        ))}
        {queue.length === 0 ? <p className="text-sm text-slate-500">{messages.hitl.empty}</p> : null}
      </aside>
      <section className="space-y-5">
        <Card className="glass-card border border-slate-800/60">
          <CardHeader className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-slate-100">{messages.hitl.title}</CardTitle>
              <p className="text-sm text-slate-400">{messages.hitl.auditTrail}</p>
            </div>
            {digestEnabled ? (
              <Badge variant="outline" className="gap-1 text-xs text-teal-200">
                <Bell className="h-3 w-3" aria-hidden />
                {messages.workspace.digestEnabledBadge}
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-slate-700/60 text-slate-200"
                onClick={handleEnableDigest}
                disabled={digestLoading}
              >
                <Bell className="h-3 w-3" aria-hidden />
                {messages.workspace.enableDigest}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <p>{detailQuery.data?.matter?.question ?? messages.hitl.empty}</p>
            {Array.isArray(detailResidency) && detailResidency.length > 0 ? (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-xs text-slate-300">
                <p className="mb-2 font-semibold uppercase tracking-wide text-slate-400">
                  {messages.research.trust.provenanceResidencyHeading}
                </p>
                <ul className="space-y-1">
                  {detailResidency.map((entry: { zone: string; count: number }) => (
                    <li key={`${entry.zone}-${entry.count}`}>
                      {messages.research.trust.provenanceResidencyItem
                        .replace('{zone}', entry.zone)
                        .replace('{count}', entry.count.toString())}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="space-y-2">
              {((detailQuery.data?.matter?.citations ?? []) as MatterCitation[]).map((citation) => (
                <div key={citation.url} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                  <p className="text-sm font-semibold text-slate-100">{citation.title ?? citation.url}</p>
                  <p className="text-xs text-slate-400">{citation.publisher ?? '—'}</p>
                </div>
              ))}
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
                disabled={!selected || actionMutation.isPending}
                onClick={() => selected && actionMutation.mutate({ id: selected, action: 'approve', comment })}
              >
                {messages.hitl.approve}
              </Button>
              <Button
                variant="outline"
                disabled={!selected || actionMutation.isPending}
                onClick={() => selected && actionMutation.mutate({ id: selected, action: 'request_changes', comment })}
              >
                {messages.hitl.requestChanges}
              </Button>
              <Button
                variant="outline"
                disabled={!selected || actionMutation.isPending}
                onClick={() => selected && actionMutation.mutate({ id: selected, action: 'reject', comment })}
              >
                {messages.hitl.reject}
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border border-slate-800/60">
          <CardHeader className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-slate-100">{messages.hitl.metricsTitle}</CardTitle>
              <p className="text-sm text-slate-400">{messages.hitl.metricsSubtitle}</p>
            </div>
            {digestEnabled ? (
              <Badge variant="outline" className="gap-1 text-xs text-teal-200">
                <Bell className="h-3 w-3" aria-hidden />
                {messages.workspace.digestEnabledBadge}
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-slate-700/60 text-slate-200"
                onClick={handleEnableDigest}
                disabled={digestLoading}
              >
                <Bell className="h-3 w-3" aria-hidden />
                {messages.workspace.enableDigest}
              </Button>
            )}
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
                    <div>
                      <p className="text-xs text-slate-400">{messages.hitl.metricsSynonymsFlagged}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {flaggedSynonyms.length > 0 ? (
                          flaggedSynonyms.map((code) => (
                            <Badge key={code} variant="outline">
                              {code}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-slate-400">{messages.hitl.metricsSynonymsNone}</span>
                        )}
                      </div>
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

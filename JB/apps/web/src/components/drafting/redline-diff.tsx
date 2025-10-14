'use client';

import { useEffect, useMemo, useState } from 'react';
import { diffWords } from 'diff';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Separator } from '../../components/ui/separator';
import type { Messages } from '../../lib/i18n';
import { cn } from '../../lib/utils';

export type RedlineStatus = 'accepted' | 'pending' | 'flagged';
export type RedlineRisk = 'low' | 'medium' | 'high';

export interface RedlineEntry {
  id: string;
  title: string;
  original: string;
  revised: string;
  impact: string;
  status: RedlineStatus;
  risk: RedlineRisk;
  citations: string[];
}

interface RedlineDiffProps {
  entries: RedlineEntry[];
  messages: Messages['drafting']['redlineViewer'];
  onExplain?: (entry: RedlineEntry) => void;
}

type DiffSegment = ReturnType<typeof diffWords>;

function formatCount(template: string, count: number) {
  return template.replace('{count}', new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(count));
}

function statusVariant(status: RedlineStatus) {
  switch (status) {
    case 'accepted':
      return 'success' as const;
    case 'pending':
      return 'warning' as const;
    case 'flagged':
    default:
      return 'danger' as const;
  }
}

function riskVariant(risk: RedlineRisk) {
  switch (risk) {
    case 'high':
      return 'danger' as const;
    case 'medium':
      return 'warning' as const;
    case 'low':
    default:
      return 'success' as const;
  }
}

function renderDiff(segments: DiffSegment | undefined, mode: 'before' | 'after') {
  if (!segments) {
    return null;
  }

  return segments.map((part, index) => {
    if (mode === 'before' && part.added) {
      return null;
    }
    if (mode === 'after' && part.removed) {
      return null;
    }

    const emphasisClass =
      (mode === 'before' && part.removed) || (mode === 'after' && part.added)
        ? part.removed
          ? 'bg-legal-red/20 text-legal-red'
          : 'bg-legal-green/20 text-legal-green'
        : 'text-slate-100';

    return (
      <span
        // eslint-disable-next-line react/no-array-index-key
        key={`${mode}-${index}`}
        className={cn('rounded px-0.5 text-sm leading-relaxed', emphasisClass)}
      >
        {part.value}
      </span>
    );
  });
}

export function RedlineDiff({ entries, messages, onExplain }: RedlineDiffProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(entries[0]?.id ?? null);

  useEffect(() => {
    setFocusedEntryId((previous) => {
      if (!previous) {
        return entries[0]?.id ?? null;
      }
      return entries.find((entry) => entry.id === previous)?.id ?? entries[0]?.id ?? null;
    });
  }, [entries]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const media = window.matchMedia('(min-width: 1024px)');

    const syncDetail = (matches: boolean) => {
      setShowDetail((current) => (matches ? true : current));
      if (matches) {
        setShowDetail(true);
      }
    };

    syncDetail(media.matches);

    const handler = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setShowDetail(true);
      }
    };

    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const summary = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        if (entry.status === 'accepted') {
          acc.accepted += 1;
        } else if (entry.status === 'pending') {
          acc.pending += 1;
        } else {
          acc.flagged += 1;
        }
        return acc;
      },
      { accepted: 0, pending: 0, flagged: 0 },
    );
  }, [entries]);

  const diffCache = useMemo(() => {
    return new Map(entries.map((entry) => [entry.id, diffWords(entry.original, entry.revised)]));
  }, [entries]);

  const selectedEntry = useMemo(() => {
    if (!focusedEntryId) {
      return entries[0] ?? null;
    }
    return entries.find((entry) => entry.id === focusedEntryId) ?? entries[0] ?? null;
  }, [entries, focusedEntryId]);

  const flaggedEntries = entries.filter((entry) => entry.status === 'flagged');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="glass-card border border-slate-800/60">
        <CardHeader>
          <CardTitle className="text-slate-100">{messages.summaryTitle}</CardTitle>
          <p className="text-sm text-slate-400">{messages.summarySubtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-900/60 p-3 text-center">
              <dt className="text-xs uppercase tracking-wide text-slate-400">{messages.acceptedLabel}</dt>
              <dd className="mt-1 text-lg font-semibold text-legal-green">
                {formatCount(messages.acceptedCount, summary.accepted)}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-900/60 p-3 text-center">
              <dt className="text-xs uppercase tracking-wide text-slate-400">{messages.pendingLabel}</dt>
              <dd className="mt-1 text-lg font-semibold text-legal-amber">
                {formatCount(messages.pendingCount, summary.pending)}
              </dd>
            </div>
            <div className="rounded-2xl bg-slate-900/60 p-3 text-center">
              <dt className="text-xs uppercase tracking-wide text-slate-400">{messages.flaggedLabel}</dt>
              <dd className="mt-1 text-lg font-semibold text-legal-red">
                {formatCount(messages.flaggedCount, summary.flagged)}
              </dd>
            </div>
          </dl>

          {flaggedEntries.length > 0 ? (
            <div className="space-y-2 rounded-2xl border border-legal-red/40 bg-legal-red/10 p-4">
              <p className="text-sm font-semibold text-legal-red">{messages.flaggedHelp}</p>
              <ul className="space-y-2 text-sm text-slate-200">
                {flaggedEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-2">
                    <span>{entry.title}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setFocusedEntryId(entry.id);
                        setShowDetail(true);
                      }}
                    >
                      {messages.inspect}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {entries.length > 0 ? (
            <Button
              className="w-full lg:hidden"
              variant="outline"
              onClick={() => setShowDetail((current) => !current)}
            >
              {showDetail ? messages.toggleSummary : messages.toggleDetail}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card className={cn('glass-card border border-slate-800/60', showDetail ? 'block' : 'hidden lg:block')}>
        <CardHeader>
          <CardTitle className="text-slate-100">{messages.detailTitle}</CardTitle>
          <p className="text-sm text-slate-400">{messages.detailSubtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-400">{messages.noEntries}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {entries.map((entry) => (
                  <Button
                    key={entry.id}
                    size="sm"
                    variant={entry.id === selectedEntry?.id ? 'default' : 'outline'}
                    onClick={() => setFocusedEntryId(entry.id)}
                  >
                    {entry.title}
                  </Button>
                ))}
              </div>

              {selectedEntry ? (
                <article className="space-y-4">
                  <header className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(selectedEntry.status)}>
                        {messages.status[selectedEntry.status]}
                      </Badge>
                      <Badge variant={riskVariant(selectedEntry.risk)}>
                        {messages.risk[selectedEntry.risk]}
                      </Badge>
                    </div>
                    <h3 className="text-base font-semibold text-slate-100">{selectedEntry.title}</h3>
                    <p className="text-sm text-slate-300">{selectedEntry.impact}</p>
                  </header>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="space-y-2 rounded-2xl bg-slate-900/60 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">{messages.beforeLabel}</p>
                      <p className="text-sm leading-relaxed text-slate-200">
                        {renderDiff(diffCache.get(selectedEntry.id), 'before')}
                      </p>
                    </section>
                    <section className="space-y-2 rounded-2xl bg-slate-900/60 p-4">
                      <p className="text-xs uppercase tracking-wide text-slate-400">{messages.afterLabel}</p>
                      <p className="text-sm leading-relaxed text-slate-200">
                        {renderDiff(diffCache.get(selectedEntry.id), 'after')}
                      </p>
                    </section>
                  </div>

                  <Separator className="border-slate-800/60" />

                  {selectedEntry.citations.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-slate-400">{messages.citationsLabel}</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedEntry.citations.map((citation) => (
                          <a
                            key={citation}
                            href={citation}
                            target="_blank"
                            rel="noreferrer"
                            className="focus-ring inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-indigo-200"
                          >
                            {messages.openCitation}
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onExplain?.(selectedEntry)}>
                      {messages.explain}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowDetail(false)}
                      className="lg:hidden"
                    >
                      {messages.toggleSummary}
                    </Button>
                  </div>
                </article>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

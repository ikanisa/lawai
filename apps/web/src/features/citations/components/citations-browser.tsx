'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { Button } from '@/ui/button';
import type { Locale, Messages } from '@/lib/i18n';
import { queryKeys } from '@/lib/query';
import { DEMO_ORG_ID, fetchCitations, fetchCorpus, fetchSnapshotDiff } from '@/lib/api';

interface CitationsBrowserProps {
  messages: Messages;
  locale: Locale;
}

interface CitationEntry {
  id: string;
  title?: string;
  jurisdiction?: string;
  url: string;
  publisher?: string;
  consolidated?: boolean;
  bindingLanguage?: string;
  languageNote?: string;
  effectiveDate?: string;
}

interface SnapshotSummary {
  id: string;
  name?: string;
  createdAt?: string;
}

export function CitationsBrowser({ messages, locale }: CitationsBrowserProps) {
  const [search, setSearch] = useState('');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string | null>(null);

  const citationsQuery = useQuery({
    queryKey: queryKeys.citations.list(DEMO_ORG_ID),
    queryFn: () => fetchCitations(DEMO_ORG_ID),
  });
  const corpusQuery = useQuery({
    queryKey: queryKeys.corpus.all(DEMO_ORG_ID),
    queryFn: () => fetchCorpus(DEMO_ORG_ID),
  });

  const entries = useMemo<CitationEntry[]>(() => {
    const list = (citationsQuery.data?.entries ?? []) as CitationEntry[];
    return list.filter((entry) => {
      const jurisdictionMatch = jurisdictionFilter ? entry.jurisdiction === jurisdictionFilter : true;
      const searchMatch = search
        ? entry.title?.toLowerCase().includes(search.toLowerCase()) || entry.url.toLowerCase().includes(search.toLowerCase())
        : true;
      return jurisdictionMatch && searchMatch;
    });
  }, [citationsQuery.data, jurisdictionFilter, search]);

  const allowlist = (corpusQuery.data?.allowlist ?? []) as Array<{ jurisdiction: string; host: string }>;
  const snapshots = useMemo<SnapshotSummary[]>(
    () => ((corpusQuery.data?.snapshots ?? []) as SnapshotSummary[]),
    [corpusQuery.data],
  );
  const [baseSnapshot, setBaseSnapshot] = useState<string | null>(null);
  const [compareSnapshot, setCompareSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!baseSnapshot && snapshots.length > 0) {
      setBaseSnapshot(snapshots[0].id);
    }
    if (!compareSnapshot && snapshots.length > 1) {
      setCompareSnapshot(snapshots[1].id);
    }
  }, [snapshots, baseSnapshot, compareSnapshot]);

  const diffQuery = useQuery({
    queryKey: [
      ...queryKeys.citations.detail(DEMO_ORG_ID, 'diff'),
      baseSnapshot ?? 'base',
      compareSnapshot ?? 'compare',
    ],
    queryFn: () => fetchSnapshotDiff(DEMO_ORG_ID, baseSnapshot as string, compareSnapshot as string),
    enabled: Boolean(baseSnapshot && compareSnapshot),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{messages.citationsBrowser.title}</h1>
          <p className="text-sm text-muted-foreground">{messages.citationsBrowser.filters}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input
            className="w-72"
            placeholder={messages.citationsBrowser.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="focus-ring rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-foreground"
            value={jurisdictionFilter ?? ''}
            onChange={(event) => setJurisdictionFilter(event.target.value || null)}
          >
            <option value="">{messages.citationsBrowser.jurisdiction}</option>
            {allowlist.map((domain: any) => (
              <option key={`${domain.jurisdiction}-${domain.host}`} value={domain.jurisdiction}>
                {domain.jurisdiction}
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setJurisdictionFilter(null)}>
            {locale === 'fr' ? 'Réinitialiser' : 'Reset'}
          </Button>
        </div>
      </header>
      <section className="grid gap-4 lg:grid-cols-2">
        {entries.map((entry) => (
          <Card key={entry.id} className="glass-card border border-border/70">
            <CardHeader className="space-y-2">
              <CardTitle className="text-foreground">{entry.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge>{entry.jurisdiction}</Badge>
                {entry.consolidated ? <Badge variant="success">{messages.citationsBrowser.consolidated}</Badge> : null}
                {entry.bindingLanguage ? (
                  <Badge variant="outline">{`${messages.citationsBrowser.bindingLanguage}: ${entry.bindingLanguage}`}</Badge>
                ) : null}
                {entry.languageNote?.toLowerCase().includes('traduction') ? (
                  <Badge variant="warning">{messages.citationsBrowser.translation}</Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>{entry.publisher ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{entry.url}</p>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{messages.citationsBrowser.metadata}</Badge>
                <span className="text-xs text-muted-foreground">
                  {messages.citationsBrowser.effectiveDate}: {entry.effectiveDate ?? '—'}
                </span>
              </div>
              <a className="focus-ring inline-flex text-xs text-primary" href={entry.url} target="_blank" rel="noreferrer">
                {messages.citationsBrowser.open}
              </a>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 ? (
          <Card className="glass-card border border-border/70">
            <CardContent className="p-6 text-sm text-muted-foreground/80">{messages.citationsBrowser.empty}</CardContent>
          </Card>
        ) : null}
      </section>
      <Card className="glass-card border border-border/70">
        <CardHeader className="space-y-2">
          <CardTitle className="text-foreground">{messages.citationsBrowser.diffTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{messages.citationsBrowser.diffInstructions}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex flex-col text-xs text-muted-foreground">
              {messages.citationsBrowser.baseLabel}
              <select
                className="focus-ring mt-1 rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-foreground"
                value={baseSnapshot ?? ''}
                onChange={(event) => setBaseSnapshot(event.target.value || null)}
              >
                <option value="">—</option>
                {snapshots.map((snapshot) => (
                  <option key={snapshot.id} value={snapshot.id}>
                    {snapshot.name ?? snapshot.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col text-xs text-muted-foreground">
              {messages.citationsBrowser.compareLabel}
              <select
                className="focus-ring mt-1 rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-foreground"
                value={compareSnapshot ?? ''}
                onChange={(event) => setCompareSnapshot(event.target.value || null)}
              >
                <option value="">—</option>
                {snapshots.map((snapshot) => (
                  <option key={`${snapshot.id}-compare`} value={snapshot.id}>
                    {snapshot.name ?? snapshot.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {baseSnapshot && compareSnapshot && diffQuery.data?.base?.warning ? (
            <Badge variant="warning">{diffQuery.data.base.warning}</Badge>
          ) : null}
          {baseSnapshot && compareSnapshot && diffQuery.data?.compare?.warning ? (
            <Badge variant="warning">{diffQuery.data.compare.warning}</Badge>
          ) : null}
          {!baseSnapshot || !compareSnapshot ? (
            <p className="text-sm text-muted-foreground/80">{messages.citationsBrowser.noDiff}</p>
          ) : diffQuery.isLoading ? (
            <p className="text-sm text-muted-foreground/80">{messages.citationsBrowser.loadingDiff}</p>
          ) : diffQuery.isError ? (
            <p className="text-sm text-rose-400">{messages.citationsBrowser.diffError}</p>
          ) : diffQuery.data?.diff?.length ? (
            <div className="rounded-2xl bg-card/60 p-4 text-sm leading-relaxed">
              {diffQuery.data.diff.map((segment: { value: string; added?: boolean; removed?: boolean }, index: number) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  className={
                    segment.added
                      ? 'rounded bg-emerald-500/20 px-1 text-emerald-200'
                      : segment.removed
                      ? 'rounded bg-rose-500/20 px-1 text-rose-200 line-through'
                      : 'text-foreground'
                  }
                >
                  {segment.value}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/80">{messages.citationsBrowser.noDiff}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

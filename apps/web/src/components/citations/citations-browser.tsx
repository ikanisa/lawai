'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import type { Locale, Messages } from '../../lib/i18n';
import {
  DEMO_ORG_ID,
  fetchCitations,
  fetchCorpus,
  fetchSnapshotDiff,
  fetchCaseScore,
  fetchCaseTreatments,
} from '../../lib/api';

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
  sourceType?: string;
  stale?: boolean;
  residencyZone?: string | null;
}

interface SnapshotSummary {
  id: string;
  name?: string;
  createdAt?: string;
  residency?: Array<{ zone: string; count: number }> | null;
  residencyZone?: string | null;
}

const JURISDICTION_RESIDENCY: Record<string, string> = {
  FR: 'eu',
  BE: 'eu',
  LU: 'eu',
  EU: 'eu',
  MC: 'eu',
  CH: 'ch',
  'CA-QC': 'ca',
  CA: 'ca',
  OHADA: 'ohada',
  MA: 'maghreb',
  TN: 'maghreb',
  DZ: 'maghreb',
  RW: 'rw',
};

function resolveResidencyZone(code?: string | null): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  return JURISDICTION_RESIDENCY[upper] ?? null;
}

export function CitationsBrowser({ messages, locale }: CitationsBrowserProps) {
  const [search, setSearch] = useState('');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<string | null>(null);

  const citationsQuery = useQuery({
    queryKey: ['citations'],
    queryFn: () => fetchCitations(DEMO_ORG_ID),
  });
  const corpusQuery = useQuery({ queryKey: ['corpus'], queryFn: () => fetchCorpus(DEMO_ORG_ID) });

  const entries = useMemo<CitationEntry[]>(() => {
    const rawEntries = (citationsQuery.data?.entries ?? []) as Array<
      CitationEntry & { residency_zone?: string | null }
    >;
    return rawEntries
      .map((entry) => ({
        ...entry,
        residencyZone: entry.residencyZone ?? entry.residency_zone ?? null,
      }))
      .filter((entry) => {
        const jurisdictionMatch = jurisdictionFilter ? entry.jurisdiction === jurisdictionFilter : true;
        const searchMatch = search
          ? entry.title?.toLowerCase().includes(search.toLowerCase()) || entry.url.toLowerCase().includes(search.toLowerCase())
          : true;
        return jurisdictionMatch && searchMatch;
      });
  }, [citationsQuery.data, jurisdictionFilter, search]);

  const allowlist = useMemo(
    () => (corpusQuery.data?.allowlist ?? []) as Array<{ jurisdiction: string; host: string }>,
    [corpusQuery.data?.allowlist],
  );
  const allowlistResidencyMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const domain of allowlist) {
      const zone = resolveResidencyZone(domain.jurisdiction) ?? null;
      map.set(domain.host.toLowerCase(), zone);
    }
    return map;
  }, [allowlist]);
  const snapshots = useMemo<SnapshotSummary[]>(
    () => ((corpusQuery.data?.snapshots ?? []) as SnapshotSummary[]),
    [corpusQuery.data],
  );
  const snapshotMap = useMemo(() => {
    const map = new Map<string, SnapshotSummary>();
    for (const snapshot of snapshots) {
      map.set(snapshot.id, snapshot);
    }
    return map;
  }, [snapshots]);
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
    queryKey: ['snapshot-diff', baseSnapshot, compareSnapshot],
    queryFn: () => fetchSnapshotDiff(DEMO_ORG_ID, baseSnapshot as string, compareSnapshot as string),
    enabled: Boolean(baseSnapshot && compareSnapshot),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">{messages.citationsBrowser.title}</h1>
          <p className="text-sm text-slate-400">{messages.citationsBrowser.filters}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Input
            className="w-72"
            placeholder={messages.citationsBrowser.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="focus-ring rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200"
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
          <Card key={entry.id} className="glass-card border border-slate-800/60">
            <CardHeader className="space-y-2">
              <CardTitle className="text-slate-100">{entry.title}</CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge>{entry.jurisdiction}</Badge>
                {entry.consolidated ? <Badge variant="success">{messages.citationsBrowser.consolidated}</Badge> : null}
                {entry.bindingLanguage ? (
                  <Badge variant="outline">{`${messages.citationsBrowser.bindingLanguage}: ${entry.bindingLanguage}`}</Badge>
                ) : null}
                {entry.languageNote?.toLowerCase().includes('traduction') ? (
                  <Badge variant="warning">{messages.citationsBrowser.translation}</Badge>
                ) : null}
                {entry.stale ? <Badge variant="warning">{messages.citationsBrowser.stale}</Badge> : null}
                {(() => {
                  let host: string | null = null;
                  try {
                    host = new URL(entry.url).hostname.toLowerCase();
                  } catch (_error) {
                    host = null;
                  }
                  const fallbackZone = host ? allowlistResidencyMap.get(host) ?? null : null;
                  const residencyZone =
                    entry.residencyZone ?? fallbackZone ?? resolveResidencyZone(entry.jurisdiction);
                  return residencyZone ? (
                    <Badge variant="outline" key={`${entry.id}-zone`}>
                      {`${messages.citationsBrowser.residency}: ${residencyZone.toUpperCase()}`}
                    </Badge>
                  ) : null;
                })()}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-200">
              <p>{entry.publisher ?? '—'}</p>
              <p className="text-xs text-slate-400">{entry.url}</p>
              {entry.sourceType === 'case' ? (
                <CaseScoreBadge
                  sourceId={entry.id}
                  messages={messages.citationsBrowser}
                  locale={locale}
                />
              ) : null}
              <div className="flex items-center gap-2">
                <Badge variant="outline">{messages.citationsBrowser.metadata}</Badge>
                <span className="text-xs text-slate-400">
                  {messages.citationsBrowser.effectiveDate}: {entry.effectiveDate ?? '—'}
                </span>
              </div>
              <a className="focus-ring inline-flex text-xs text-teal-200" href={entry.url} target="_blank" rel="noreferrer">
                {messages.citationsBrowser.open}
              </a>
            </CardContent>
          </Card>
        ))}
        {entries.length === 0 ? (
          <Card className="glass-card border border-slate-800/60">
            <CardContent className="p-6 text-sm text-slate-500">{messages.citationsBrowser.empty}</CardContent>
          </Card>
        ) : null}
      </section>
      <Card className="glass-card border border-slate-800/60">
        <CardHeader className="space-y-2">
          <CardTitle className="text-slate-100">{messages.citationsBrowser.diffTitle}</CardTitle>
          <p className="text-sm text-slate-400">{messages.citationsBrowser.diffInstructions}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex flex-col text-xs text-slate-400">
              {messages.citationsBrowser.baseLabel}
              <select
                className="focus-ring mt-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200"
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
            <label className="flex flex-col text-xs text-slate-400">
              {messages.citationsBrowser.compareLabel}
              <select
                className="focus-ring mt-1 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200"
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
          <div className="grid gap-3 md:grid-cols-2">
            {[baseSnapshot, compareSnapshot].map((id, index) => {
              if (!id) return null;
              const snapshot = snapshotMap.get(id);
              if (!snapshot) return null;
              const residency = Array.isArray(snapshot.residency) ? snapshot.residency : [];
              const heading = index === 0 ? messages.citationsBrowser.baseLabel : messages.citationsBrowser.compareLabel;
              return (
                <div key={id} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-xs text-slate-300">
                  <p className="font-semibold uppercase tracking-wide text-slate-400">{heading}</p>
                  <p className="mt-1 text-sm text-slate-100">{snapshot.name ?? id}</p>
                  {(() => {
                    const zone = snapshot.residencyZone ?? null;
                    if (!zone) return null;
                    return (
                      <div className="mt-2 inline-flex items-center gap-2">
                        <Badge variant="outline">{zone}</Badge>
                        <span>{messages.research.trust.provenanceResidencyHeading}</span>
                      </div>
                    );
                  })()}
                  {residency.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {residency.map((entry) => (
                        <li key={`${id}-${entry.zone}`}>
                          {messages.research.trust.provenanceResidencyItem
                            .replace('{zone}', entry.zone)
                            .replace('{count}', entry.count.toString())}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
          {!baseSnapshot || !compareSnapshot ? (
            <p className="text-sm text-slate-500">{messages.citationsBrowser.noDiff}</p>
          ) : diffQuery.isLoading ? (
            <p className="text-sm text-slate-500">{messages.citationsBrowser.loadingDiff}</p>
          ) : diffQuery.isError ? (
            <p className="text-sm text-rose-400">{messages.citationsBrowser.diffError}</p>
          ) : diffQuery.data?.diff?.length ? (
            <div className="rounded-2xl bg-slate-900/60 p-4 text-sm leading-relaxed">
              {diffQuery.data.diff.map((segment: { value: string; added?: boolean; removed?: boolean }, index: number) => (
                <span
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  className={
                    segment.added
                      ? 'rounded bg-emerald-500/20 px-1 text-emerald-200'
                      : segment.removed
                      ? 'rounded bg-rose-500/20 px-1 text-rose-200 line-through'
                      : 'text-slate-100'
                  }
                >
                  {segment.value}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{messages.citationsBrowser.noDiff}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type CaseScoreBadgeProps = {
  sourceId: string;
  messages: Messages['citationsBrowser'];
  locale: Locale;
};

const TREATMENT_VARIANT = {
  followed: 'success',
  applied: 'success',
  affirmed: 'success',
  distinguished: 'warning',
  criticized: 'warning',
  negative: 'danger',
  overruled: 'danger',
  vacated: 'danger',
  pending_appeal: 'warning',
  questioned: 'outline',
  unknown: 'outline',
} as const;

type TreatmentCode = keyof typeof TREATMENT_VARIANT;

const isTreatmentCode = (value: string): value is TreatmentCode => value in TREATMENT_VARIANT;

function CaseScoreBadge({ sourceId, messages, locale }: CaseScoreBadgeProps) {
  const scoreQuery = useQuery({
    queryKey: ['case-score', sourceId],
    queryFn: () => fetchCaseScore(DEMO_ORG_ID, sourceId),
    staleTime: 60_000,
  });
  const treatmentsQuery = useQuery({
    queryKey: ['case-treatments', sourceId],
    queryFn: () => fetchCaseTreatments(DEMO_ORG_ID, sourceId),
    staleTime: 60_000,
  });

  if (scoreQuery.isLoading) {
    return <Badge variant="outline">Score…</Badge>;
  }

  const score = scoreQuery.data;
  if (!score) {
    return null;
  }

  const treatments = treatmentsQuery.data?.treatments ?? [];
  const treatmentLabels = messages.treatmentLabels ?? {};
  const band = score.score >= 85 ? 'success' : score.score >= 70 ? 'warning' : 'default';

  const formatDate = (value: string | null | undefined) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const treatmentSection = (() => {
    if (treatmentsQuery.isLoading) {
      return <p className="text-xs text-slate-500">{messages.treatmentLoading}</p>;
    }
    if (treatmentsQuery.isError) {
      return <p className="text-xs text-rose-400">{messages.treatmentError}</p>;
    }
    if (treatments.length === 0) {
      return <p className="text-xs text-slate-500">{messages.treatmentNone}</p>;
    }
    const labelMap = treatmentLabels as Partial<Record<TreatmentCode, string>>;
    return (
      <div className="flex flex-wrap gap-2">
        {treatments.map((treatment, index) => {
          const treatmentCode = isTreatmentCode(treatment.treatment) ? treatment.treatment : 'unknown';
          const label = labelMap[treatmentCode] ?? treatment.treatment;
          const decidedAt = formatDate(treatment.decidedAt ?? null);
          const variant = TREATMENT_VARIANT[treatmentCode] ?? 'outline';
          return (
            <Badge
              key={`${sourceId}-treatment-${index}`}
              variant={variant}
              title={decidedAt ?? undefined}
            >
              {decidedAt ? `${label} · ${decidedAt}` : label}
            </Badge>
          );
        })}
      </div>
    );
  })();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={band as any}>Score {Math.round(score.score)}</Badge>
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer text-teal-200">Why this score</summary>
          <div className="mt-2 space-y-1">
            {Object.entries(score.axes).map(([axis, value]) => (
              <div key={axis} className="flex items-center justify-between gap-3">
                <span className="text-slate-300">{axis}</span>
                <span>{Math.round(Number(value))}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{messages.treatments}</Badge>
        </div>
        {treatmentSection}
      </div>
    </div>
  );
}

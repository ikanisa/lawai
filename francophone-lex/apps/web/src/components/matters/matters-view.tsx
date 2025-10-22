'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Separator } from '../../components/ui/separator';
import { Input } from '../../components/ui/input';
import type { Locale, Messages } from '../../lib/i18n';
import { fetchMatters, fetchMatterDetail } from '../../lib/api';
import { useRequiredSession } from '../session-provider';

interface MattersViewProps {
  messages: Messages;
  locale: Locale;
}

interface MatterListItem {
  id: string;
  question: string;
  jurisdiction?: string | null;
  status?: string | null;
  riskLevel?: string | null;
  hitlRequired?: boolean | null;
}

interface MatterDetail {
  id: string;
  question: string;
  jurisdiction?: string | null;
  riskLevel?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  status?: string | null;
  hitlRequired?: boolean | null;
  citations?: Array<{ title?: string | null; publisher?: string | null; url: string; domainOk?: boolean | null }>;
}

export function MattersView({ messages, locale }: MattersViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const session = useRequiredSession();
  const orgId = session.orgId;
  const userId = session.userId;
  const hasSession = Boolean(orgId && userId);

  const mattersQuery = useQuery({
    queryKey: ['matters', orgId, userId],
    queryFn: () => fetchMatters(orgId, userId),
    enabled: hasSession,
  });

  const detailQuery = useQuery({
    queryKey: ['matter', orgId, userId, selectedId],
    enabled: hasSession && Boolean(selectedId),
    queryFn: () => fetchMatterDetail(orgId, userId, selectedId ?? ''),
  });

  useEffect(() => {
    if (!selectedId && mattersQuery.data?.matters?.length) {
      setSelectedId(mattersQuery.data.matters[0].id);
    }
  }, [mattersQuery.data, selectedId]);

  const matters = useMemo<MatterListItem[]>(() => {
    const rows = (mattersQuery.data?.matters ?? []) as MatterListItem[];
    if (!filter.trim()) return rows;
    const lower = filter.toLowerCase();
    return rows.filter((matter) => matter.question.toLowerCase().includes(lower));
  }, [mattersQuery.data, filter]);

  const statusChip = (status?: string | null) => {
    if (!status) return null;
    const normalized = status.toLowerCase();
    const label = messages.matters.status[normalized as keyof typeof messages.matters.status] ?? status;
    const variant = normalized === 'closed' ? 'default' : normalized === 'review' ? 'warning' : 'outline';
    return (
      <Badge variant={variant} className="uppercase tracking-wide">
        {label}
      </Badge>
    );
  };

  const timeline = useMemo(() => {
    const data = detailQuery.data?.matter as MatterDetail | undefined;
    if (!data) return [] as Array<{ label: string; date: string | null }>;
    const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: undefined });
    return [
      { label: messages.matters.overview, date: data.startedAt ? formatter.format(new Date(data.startedAt)) : null },
      { label: messages.matters.citeCheck, date: data.finishedAt ? formatter.format(new Date(data.finishedAt)) : null },
    ];
  }, [detailQuery.data, messages.matters, locale]);

  const computeDeadline = useMutation({
    mutationFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return { deadline: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() };
    },
    onSuccess: (result) => {
      const formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
      toast.success(`${messages.matters.deadlineWizard}: ${formatter.format(new Date(result.deadline))}`);
    },
    onError: () => {
      toast.error(locale === 'fr' ? 'Calcul impossible' : 'Unable to compute');
    },
  });

  if (!hasSession) {
    return null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="space-y-4">
        <div className="glass-card rounded-3xl border border-slate-800/60 p-4">
          <label className="text-xs font-semibold uppercase text-slate-400" htmlFor="matter-search">
            {messages.research.filters}
          </label>
          <Input
            id="matter-search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={locale === 'fr' ? 'Rechercher un dossier…' : 'Search a matter…'}
          />
        </div>
        <div className="space-y-3">
          {matters.map((matter) => (
            <button
              key={matter.id}
              type="button"
              onClick={() => setSelectedId(matter.id)}
              className={`focus-ring w-full rounded-3xl border px-4 py-3 text-left transition ${
                matter.id === selectedId
                  ? 'border-teal-400/80 bg-teal-400/10 text-teal-100'
                  : 'border-slate-800/60 bg-slate-900/60 text-slate-200 hover:border-teal-400/50'
              }`}
            >
              <p className="text-sm font-semibold">{matter.question}</p>
              <p className="text-xs text-slate-400">{matter.jurisdiction ?? '—'}</p>
              <div className="mt-2 flex items-center gap-2">
                {statusChip(matter.status)}
                {matter.hitlRequired ? (
                  <Badge variant="outline" className="border-amber-300/60 text-amber-200">
                    {messages.workspace.requiresHitl}
                  </Badge>
                ) : null}
              </div>
            </button>
          ))}
          {matters.length === 0 ? (
            <p className="text-sm text-slate-500">{messages.matters.empty}</p>
          ) : null}
        </div>
      </aside>
      <section className="space-y-6">
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-slate-100">
              {messages.matters.overview}
              {detailQuery.data?.matter ? statusChip(detailQuery.data.matter.status) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <p>{detailQuery.data?.matter?.question ?? messages.matters.empty}</p>
            <Separator className="bg-slate-800/60" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-slate-400">{messages.matters.parties}</p>
                <p className="text-sm text-slate-200">—</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">{messages.matters.governingLaw}</p>
                <p className="text-sm text-slate-200">{detailQuery.data?.matter?.jurisdiction ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">{messages.matters.risk}</p>
                <p className="text-sm text-slate-200">{detailQuery.data?.matter?.riskLevel ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">{messages.matters.timeline}</p>
                <ul className="space-y-1 text-xs text-slate-400">
                  {timeline.map((item) => (
                    <li key={item.label}>
                      <span className="font-semibold text-slate-300">{item.label}</span>: {item.date ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.matters.deadlineWizard}</CardTitle>
            <p className="text-sm text-slate-400">{messages.matters.deadlineNotes}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input placeholder={messages.matters.procedure} />
              <Input placeholder={messages.matters.timezone} />
              <Button onClick={() => computeDeadline.mutate()} disabled={computeDeadline.isPending}>
                {messages.matters.compute}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.matters.documents}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {(detailQuery.data?.matter?.citations as MatterDetail['citations'] | undefined)?.map((citation) => (
              <div key={citation.url} className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4">
                <p className="font-semibold text-slate-100">{citation.title ?? citation.url}</p>
                <p className="text-xs text-slate-400">{citation.publisher ?? '—'}</p>
                <a
                  className="focus-ring mt-2 inline-flex text-xs text-teal-200"
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {messages.citationsBrowser.open}
                </a>
              </div>
            ))}
            {!(detailQuery.data?.matter?.citations?.length ?? 0) ? (
              <p className="text-sm text-slate-500">{messages.matters.citeCheck}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

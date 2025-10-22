'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Separator } from '@/ui/separator';
import { Input } from '@/ui/input';
import type { Locale, Messages } from '@/lib/i18n';
import { queryKeys } from '@/lib/query';
import { DEMO_ORG_ID, fetchMatters, fetchMatterDetail } from '@/lib/api';

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

  const mattersQuery = useQuery({
    queryKey: queryKeys.matters.list(DEMO_ORG_ID),
    queryFn: () => fetchMatters(DEMO_ORG_ID),
  });

  const detailQuery = useQuery({
    queryKey: queryKeys.matters.detail(DEMO_ORG_ID, selectedId ?? 'unselected'),
    enabled: Boolean(selectedId),
    queryFn: () => fetchMatterDetail(DEMO_ORG_ID, selectedId ?? ''),
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

  return (
    <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
      <aside className="space-y-4">
        <div className="glass-card rounded-3xl border border-border/70 p-4">
          <label className="text-xs font-semibold uppercase text-muted-foreground" htmlFor="matter-search">
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
                  ? 'border-primary/80 bg-primary/10 text-primary/80'
                  : 'border-border/70 bg-muted/60 text-muted-foreground hover:border-primary/60'
              }`}
            >
              <p className="text-sm font-semibold">{matter.question}</p>
              <p className="text-xs text-muted-foreground">{matter.jurisdiction ?? '—'}</p>
              <div className="mt-2 flex items-center gap-2">
                {statusChip(matter.status)}
                {matter.hitlRequired ? (
                  <Badge variant="outline" className="border-warning/60 text-warning-foreground">
                    {messages.workspace.requiresHitl}
                  </Badge>
                ) : null}
              </div>
            </button>
          ))}
          {matters.length === 0 ? (
            <p className="text-sm text-muted-foreground/80">{messages.matters.empty}</p>
          ) : null}
        </div>
      </aside>
      <section className="space-y-6">
        <Card className="glass-card border border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-foreground">
              {messages.matters.overview}
              {detailQuery.data?.matter ? statusChip(detailQuery.data.matter.status) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>{detailQuery.data?.matter?.question ?? messages.matters.empty}</p>
            <Separator className="bg-muted/60" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-muted-foreground">{messages.matters.parties}</p>
                <p className="text-sm text-muted-foreground">—</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">{messages.matters.governingLaw}</p>
                <p className="text-sm text-muted-foreground">{detailQuery.data?.matter?.jurisdiction ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">{messages.matters.risk}</p>
                <p className="text-sm text-muted-foreground">{detailQuery.data?.matter?.riskLevel ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">{messages.matters.timeline}</p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {timeline.map((item) => (
                    <li key={item.label}>
                      <span className="font-semibold text-muted-foreground">{item.label}</span>: {item.date ?? '—'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-border/70">
          <CardHeader>
            <CardTitle className="text-foreground">{messages.matters.deadlineWizard}</CardTitle>
            <p className="text-sm text-muted-foreground">{messages.matters.deadlineNotes}</p>
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

        <Card className="glass-card border border-border/70">
          <CardHeader>
            <CardTitle className="text-foreground">{messages.matters.documents}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {(detailQuery.data?.matter?.citations as MatterDetail['citations'] | undefined)?.map((citation) => (
              <div key={citation.url} className="rounded-2xl border border-border/70 bg-muted/50 p-4">
                <p className="font-semibold text-foreground">{citation.title ?? citation.url}</p>
                <p className="text-xs text-muted-foreground">{citation.publisher ?? '—'}</p>
                <a
                  className="focus-ring mt-2 inline-flex text-xs text-primary"
                  href={citation.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {messages.citationsBrowser.open}
                </a>
              </div>
            ))}
            {!(detailQuery.data?.matter?.citations?.length ?? 0) ? (
              <p className="text-sm text-muted-foreground/80">{messages.matters.citeCheck}</p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

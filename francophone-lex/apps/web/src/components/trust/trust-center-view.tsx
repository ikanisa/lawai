'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { OperationsOverviewCard } from '../governance/operations-overview-card';
import type { Locale, Messages } from '../../lib/i18n';
import {
  DEMO_ORG_ID,
  fetchGovernancePublications,
  fetchOperationsOverview,
  type OperationsOverviewResponse,
} from '../../lib/api';

interface GovernancePublication {
  slug: string;
  title: string;
  summary: string | null;
  doc_url: string | null;
  category: string | null;
  published_at?: string | null;
}

interface TrustCenterViewProps {
  messages: Messages;
  locale: Locale;
}

export function TrustCenterView({ messages, locale }: TrustCenterViewProps) {
  const trustMessages = messages.trust;
  const operationsQuery = useQuery<OperationsOverviewResponse>({
    queryKey: ['operations-overview', DEMO_ORG_ID],
    queryFn: () => fetchOperationsOverview(DEMO_ORG_ID),
    staleTime: 60_000,
  });
  const publicationsQuery = useQuery<GovernancePublication[]>({
    queryKey: ['governance-publications'],
    queryFn: () => fetchGovernancePublications(DEMO_ORG_ID),
    staleTime: 300_000,
  });

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const publications = publicationsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <header className="glass-card rounded-3xl border border-slate-800/60 bg-slate-900/40 p-6 text-slate-100">
        <h1 className="text-2xl font-semibold">{trustMessages.title}</h1>
        <p className="mt-2 text-sm text-slate-400">{trustMessages.description}</p>
      </header>

      <OperationsOverviewCard
        messages={messages}
        data={operationsQuery.data ?? null}
        loading={operationsQuery.isLoading && !operationsQuery.data}
        locale={locale === 'en' ? 'en-US' : 'fr-FR'}
      />

      <Card className="glass-card border border-slate-800/60">
        <CardHeader>
          <CardTitle className="text-slate-100">{trustMessages.publicationsTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {publicationsQuery.isLoading && publications.length === 0 ? (
            <p className="text-sm text-slate-400">{trustMessages.loading}</p>
          ) : publications.length === 0 ? (
            <p className="text-sm text-slate-400">{trustMessages.publicationsEmpty}</p>
          ) : (
            publications.map((doc) => (
              <article
                key={doc.slug}
                className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium text-slate-100">{doc.title}</h3>
                  <span className="text-xs text-slate-400">
                    {trustMessages.publishedOn.replace(
                      '{date}',
                      doc.published_at ? dateFormatter.format(new Date(doc.published_at)) : '—',
                    )}
                  </span>
                </div>
                {doc.summary ? <p className="mt-2 text-slate-300">{doc.summary}</p> : null}
                {doc.doc_url ? (
                  <a
                    className="mt-3 inline-flex items-center text-sm text-sky-300 underline-offset-4 hover:underline"
                    href={doc.doc_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {trustMessages.viewDocument}
                  </a>
                ) : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

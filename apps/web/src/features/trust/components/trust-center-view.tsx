'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';
import type { Messages } from '@/lib/i18n';
import {
  getGovernancePublications,
  getOperationsOverview,
  type GovernancePublicationsResponse,
  type OperationsOverviewResponse,
} from '@/lib/api';
import { useRequiredSession } from '@avocat-ai/auth';
import { OperationsOverviewCard } from '@/components/governance/operations-overview-card';

interface TrustCenterViewProps {
  messages: Messages;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

export function TrustCenterView({ messages }: TrustCenterViewProps) {
  const { orgId } = useRequiredSession();
  const operationsQuery = useQuery<OperationsOverviewResponse>({
    queryKey: ['trust-operations-overview', orgId],
    queryFn: () => getOperationsOverview(orgId),
    staleTime: 120_000,
  });

  const publicationsQuery = useQuery<GovernancePublicationsResponse>({
    queryKey: ['trust-governance-publications', orgId],
    queryFn: () => getGovernancePublications({ status: 'published', orgId }),
    staleTime: 120_000,
  });

  const trustMessages = messages.trust;
  const loadingText = messages.admin.loadingShort;
  const publications = useMemo(
    () => publicationsQuery.data?.publications ?? [],
    [publicationsQuery.data?.publications],
  );

  const publicationsByCategory = useMemo(() => {
    const groups = new Map<string, typeof publications>();
    for (const publication of publications) {
      const key = publication.category ?? 'general';
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(publication);
      } else {
        groups.set(key, [publication]);
      }
    }
    return Array.from(groups.entries()).map(([category, items]) => ({
      category,
      items: items.sort((a, b) => {
        const aTime = a.published_at ? new Date(a.published_at).getTime() : 0;
        const bTime = b.published_at ? new Date(b.published_at).getTime() : 0;
        return bTime - aTime;
      }),
    }));
  }, [publications]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-100">{trustMessages.title}</h1>
        <p className="text-sm text-slate-400">{trustMessages.description}</p>
      </header>

      <OperationsOverviewCard
        messages={messages}
        data={operationsQuery.data ?? null}
        loading={operationsQuery.isLoading && !operationsQuery.data}
      />

      <Card className="glass-card border border-slate-800/60">
        <CardHeader>
          <CardTitle className="text-slate-100">{trustMessages.publicationsTitle}</CardTitle>
          <p className="text-sm text-slate-400">{trustMessages.publicationsDescription}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {publicationsQuery.isLoading && publications.length === 0 ? (
            <p className="text-sm text-slate-400">{loadingText}</p>
          ) : publications.length === 0 ? (
            <p className="text-sm text-slate-400">{trustMessages.publicationsEmpty}</p>
          ) : (
            publicationsByCategory.map(({ category, items }) => {
              const label = trustMessages.categories[category as keyof typeof trustMessages.categories] ?? category;
              return (
                <section key={category} className="space-y-3">
                  <h3 className="text-base font-semibold text-slate-100">{label}</h3>
                  <div className="space-y-3">
                    {items.map((publication) => (
                      <article
                        key={publication.slug}
                        className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-sm text-slate-200"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-medium text-slate-100">{publication.title}</h4>
                          {publication.published_at ? (
                            <span className="text-xs text-slate-400">
                              {trustMessages.publishedOn.replace(
                                '{date}',
                                dateFormatter.format(new Date(publication.published_at)),
                              )}
                            </span>
                          ) : null}
                        </div>
                        {publication.summary ? (
                          <p className="mt-2 text-slate-300">{publication.summary}</p>
                        ) : null}
                        {publication.doc_url ? (
                          <a
                            className="mt-3 inline-flex items-center text-sm text-sky-300 underline-offset-4 hover:underline"
                            href={publication.doc_url}
                          >
                            {trustMessages.viewDocument}
                          </a>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import type { Messages } from '@/lib/i18n';
import { queryKeys } from '@/lib/query';
import {
  DEMO_ORG_ID,
  getGovernancePublications,
  getOperationsOverview,
  type GovernancePublicationsResponse,
  type OperationsOverviewResponse,
} from '@/lib/api';
import { OperationsOverviewCard } from '@/components/governance/operations-overview-card';

interface TrustCenterViewProps {
  messages: Messages;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' });

export function TrustCenterView({ messages }: TrustCenterViewProps) {
  const operationsQuery = useQuery<OperationsOverviewResponse>({
    queryKey: queryKeys.trust.detail(DEMO_ORG_ID, 'operations-overview'),
    queryFn: () => getOperationsOverview(DEMO_ORG_ID),
    staleTime: 120_000,
  });

  const publicationsQuery = useQuery<GovernancePublicationsResponse>({
    queryKey: queryKeys.trust.list('governance-publications'),
    queryFn: () => getGovernancePublications({ status: 'published' }),
    staleTime: 120_000,
  });

  const trustMessages = messages.trust;
  const loadingText = messages.admin.loadingShort;
  const publications = publicationsQuery.data?.publications ?? [];

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
        <h1 className="text-2xl font-semibold text-foreground">{trustMessages.title}</h1>
        <p className="text-sm text-muted-foreground">{trustMessages.description}</p>
      </header>

      <OperationsOverviewCard
        messages={messages}
        data={operationsQuery.data ?? null}
        loading={operationsQuery.isLoading && !operationsQuery.data}
      />

      <Card className="glass-card border border-border/70">
        <CardHeader>
          <CardTitle className="text-foreground">{trustMessages.publicationsTitle}</CardTitle>
          <p className="text-sm text-muted-foreground">{trustMessages.publicationsDescription}</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {publicationsQuery.isLoading && publications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{loadingText}</p>
          ) : publications.length === 0 ? (
            <p className="text-sm text-muted-foreground">{trustMessages.publicationsEmpty}</p>
          ) : (
            publicationsByCategory.map(({ category, items }) => {
              const label = trustMessages.categories[category as keyof typeof trustMessages.categories] ?? category;
              return (
                <section key={category} className="space-y-3">
                  <h3 className="text-base font-semibold text-foreground">{label}</h3>
                  <div className="space-y-3">
                    {items.map((publication) => (
                      <article
                        key={publication.slug}
                        className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="font-medium text-foreground">{publication.title}</h4>
                          {publication.published_at ? (
                            <span className="text-xs text-muted-foreground">
                              {trustMessages.publishedOn.replace(
                                '{date}',
                                dateFormatter.format(new Date(publication.published_at)),
                              )}
                            </span>
                          ) : null}
                        </div>
                        {publication.summary ? (
                          <p className="mt-2 text-muted-foreground">{publication.summary}</p>
                        ) : null}
                        {publication.doc_url ? (
                          <a
                            className="mt-3 inline-flex items-center text-sm text-primary underline-offset-4 hover:underline"
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

import dynamic from 'next/dynamic';
import { dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/get-query-client';
import { auditsQueryOptions, incidentsQueryOptions, trendsQueryOptions } from '@/lib/api';
import { Hero } from '@/components/Hero';
import { Hydrate } from '@/providers/providers';

const TrendGrid = dynamic(() => import('@/components/TrendGrid').then((mod) => ({ default: mod.TrendGrid })), {
  loading: () => (
    <section className="card" aria-live="polite">
      <h2>Operational targets</h2>
      <p>Loading metrics…</p>
    </section>
  ),
});

const IncidentList = dynamic(() => import('@/components/IncidentList').then((mod) => ({ default: mod.IncidentList })), {
  loading: () => (
    <section className="card" aria-live="polite">
      <h2>Active incidents</h2>
      <p>Loading incidents…</p>
    </section>
  ),
});

const AuditTimeline = dynamic(() => import('@/components/AuditTimeline').then((mod) => ({ default: mod.AuditTimeline })), {
  ssr: false,
  loading: () => (
    <section className="card" aria-live="polite">
      <h2>Audit checklist</h2>
      <p>Loading tasks…</p>
    </section>
  ),
});

export default async function Page() {
  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(trendsQueryOptions()),
    queryClient.prefetchQuery(incidentsQueryOptions()),
    queryClient.prefetchQuery(auditsQueryOptions()),
  ]);
  const state = dehydrate(queryClient);

  return (
    <Hydrate state={state}>
      <div className="card-grid">
        <Hero />
        <TrendGrid />
        <IncidentList />
        <AuditTimeline />
      </div>
    </Hydrate>
  );
}

import dynamic from 'next/dynamic';
import { dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/get-query-client';
import { deploymentsQueryOptions, incidentsQueryOptions } from '@/lib/api';
import { Hydrate } from '@/providers/providers';

const DeploymentQueue = dynamic(() => import('@/components/DeploymentQueue').then((mod) => ({ default: mod.DeploymentQueue })), {
  ssr: false,
  loading: () => (
    <section className="card" aria-live="polite">
      <h2>Deployment queue</h2>
      <p>Compiling…</p>
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

export const metadata = {
  title: 'Deployment & incident reports | Avocat AI admin hub',
};

export default async function ReportsPage() {
  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(deploymentsQueryOptions()),
    queryClient.prefetchQuery(incidentsQueryOptions()),
  ]);
  const state = dehydrate(queryClient);

  return (
    <Hydrate state={state}>
      <div className="card-grid">
        <DeploymentQueue />
        <IncidentList />
      </div>
    </Hydrate>
  );
}

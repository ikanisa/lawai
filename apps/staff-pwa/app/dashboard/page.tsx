import dynamic from 'next/dynamic';
import { dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/get-query-client';
import { metricsQueryOptions, shiftsQueryOptions } from '@/lib/api';
import { Hydrate } from '@/providers/providers';

const MetricsPanel = dynamic(() => import('@/components/MetricsPanel').then((mod) => ({ default: mod.MetricsPanel })), {
  ssr: false,
  loading: () => (
    <section className="card" aria-live="polite">
      <h2>Mission metrics</h2>
      <p>Syncing telemetry…</p>
    </section>
  ),
});

const ShiftOverview = dynamic(() => import('@/components/ShiftOverview').then((mod) => ({ default: mod.ShiftOverview })), {
  loading: () => (
    <section className="card" aria-live="polite">
      <h2>Shift coverage</h2>
      <p>Loading roster…</p>
    </section>
  ),
});

export const metadata = {
  title: 'Avocat AI field staff dashboard',
};

export default async function DashboardPage() {
  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(metricsQueryOptions()),
    queryClient.prefetchQuery(shiftsQueryOptions()),
  ]);
  const state = dehydrate(queryClient);

  return (
    <Hydrate state={state}>
      <div className="card-grid">
        <MetricsPanel />
        <ShiftOverview />
      </div>
    </Hydrate>
  );
}

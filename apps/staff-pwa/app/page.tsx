import dynamic from 'next/dynamic';
import { dehydrate } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/get-query-client';
import { announcementsQueryOptions, shiftsQueryOptions } from '@/lib/api';
import { Hero } from '@/components/Hero';
import { AnnouncementMarquee } from '@/components/AnnouncementMarquee';
import { Hydrate } from '@/providers/providers';

const ShiftOverview = dynamic(() => import('@/components/ShiftOverview').then((mod) => ({ default: mod.ShiftOverview })), {
  loading: () => (
    <section className="card" aria-live="polite">
      <h2>Shift coverage</h2>
      <p>Loading roster…</p>
    </section>
  ),
});

export default async function Page() {
  const queryClient = createQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(shiftsQueryOptions()),
    queryClient.prefetchQuery(announcementsQueryOptions()),
  ]);
  const dehydratedState = dehydrate(queryClient);

  return (
    <Hydrate state={dehydratedState}>
      <div className="card-grid" role="list">
        <Hero />
        <AnnouncementMarquee />
        <ShiftOverview />
      </div>
    </Hydrate>
  );
}

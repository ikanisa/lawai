'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { announcementsQueryOptions } from '@/lib/api';

export function AnnouncementMarquee() {
  const { data } = useQuery(announcementsQueryOptions());
  const announcements = data ?? [];
  const latest = useMemo(
    () => announcements.map((item) => `${new Date(item.publishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – ${item.message}`),
    [announcements],
  );

  if (!announcements.length) {
    return null;
  }

  return (
    <section className="card" aria-label="Announcements ticker">
      <div className="badge">Live updates</div>
      <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
        {latest.map((item) => (
          <li key={item} style={{ padding: '0.25rem 0' }}>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

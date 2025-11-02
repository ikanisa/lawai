'use client';

import { useQuery } from '@tanstack/react-query';
import { auditsQueryOptions } from '@/lib/api';

export function AuditTimeline() {
  const { data } = useQuery(auditsQueryOptions());
  const events = data ?? [];

  return (
    <section className="card" aria-labelledby="audit-timeline-heading">
      <h2 id="audit-timeline-heading">Audit checklist</h2>
      <ol style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
        {events.map((event) => (
          <li key={event.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
              <div>
                <strong>{event.name}</strong>
                <p style={{ margin: '0.25rem 0 0', color: '#cbd5f5' }}>
                  Updated {new Date(event.updatedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className="badge" aria-label={`Status ${event.status}`}>
                {event.status === 'complete' ? 'Complete' : 'In progress'}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

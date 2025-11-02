'use client';

import { useQuery } from '@tanstack/react-query';
import { incidentsQueryOptions } from '@/lib/api';

const severityColor: Record<'low' | 'medium' | 'high', string> = {
  low: 'rgba(34, 197, 94, 0.2)',
  medium: 'rgba(250, 204, 21, 0.2)',
  high: 'rgba(248, 113, 113, 0.2)',
};

export function IncidentList() {
  const { data } = useQuery(incidentsQueryOptions());
  const incidents = data ?? [];

  return (
    <section className="card" aria-labelledby="incident-log-heading">
      <h2 id="incident-log-heading">Active incidents</h2>
      <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
        {incidents.map((incident) => (
          <li key={incident.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'baseline' }}>
              <div>
                <strong>{incident.title}</strong>
                <p style={{ margin: '0.25rem 0 0', color: '#cbd5f5' }}>
                  Owner {incident.owner} — opened {new Date(incident.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span
                className="badge"
                style={{ background: severityColor[incident.severity], color: '#020617' }}
                aria-label={`Severity ${incident.severity}`}
              >
                {incident.severity}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

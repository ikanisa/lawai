'use client';

import { useQuery } from '@tanstack/react-query';
import { metricsQueryOptions } from '@/lib/api';

export function MetricsPanel() {
  const { data } = useQuery(metricsQueryOptions());
  const metrics = data ?? [];

  return (
    <section className="card" aria-labelledby="metrics-heading">
      <h2 id="metrics-heading">Mission metrics</h2>
      <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
        {metrics.map((metric) => (
          <li key={metric.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.5rem' }}>
              <div>
                <strong>{metric.label}</strong>
                <p style={{ margin: '0.25rem 0 0', color: '#cbd5f5' }}>{metric.delta}</p>
              </div>
              <span className="badge">{metric.value}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

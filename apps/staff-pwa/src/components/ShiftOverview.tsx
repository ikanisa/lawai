'use client';

import { useQuery } from '@tanstack/react-query';
import { shiftsQueryOptions } from '@/lib/api';

function coverageLabel(coverage: number) {
  if (coverage >= 0.9) return 'coverage green';
  if (coverage >= 0.75) return 'coverage yellow';
  return 'coverage red';
}

export function ShiftOverview() {
  const { data: shifts } = useQuery(shiftsQueryOptions());

  if (!shifts) {
    return (
      <section className="card" aria-live="polite">
        <h2>Shift coverage</h2>
        <p>Loading roster…</p>
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="shift-overview-heading">
      <h2 id="shift-overview-heading">Shift coverage</h2>
      <ul style={{ listStyle: 'none', margin: '0.75rem 0 0', padding: 0 }}>
        {shifts.map((shift) => (
          <li key={shift.id} style={{ padding: '0.75rem 0', borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '0.75rem' }}>
              <div>
                <strong>{shift.location}</strong>
                <p style={{ margin: '0.25rem 0 0', color: '#cbd5f5' }}>
                  {new Date(shift.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                  {new Date(shift.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <span className="badge" aria-label={`Staffing ${coverageLabel(shift.coverage)}`}>
                {(shift.coverage * 100).toFixed(0)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

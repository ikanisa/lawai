'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { trendsQueryOptions } from '@/lib/api';

export function TrendGrid() {
  const { data } = useQuery(trendsQueryOptions());
  const trends = data ?? [];
  const summaries = useMemo(
    () =>
      trends.map((trend) => ({
        ...trend,
        delta: trend.value - trend.target,
      })),
    [trends],
  );

  return (
    <section className="card" aria-labelledby="trend-grid-heading">
      <h2 id="trend-grid-heading">Operational targets</h2>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {summaries.map((trend) => (
          <div
            key={trend.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.75rem',
            }}
          >
            <div>
              <strong>{trend.label}</strong>
              <p style={{ margin: '0.25rem 0 0', color: '#cbd5f5' }}>
                Target {trend.target}
                {trend.unit} ({trend.delta >= 0 ? '+' : ''}
                {trend.delta.toFixed(1)} {trend.unit} vs goal)
              </p>
            </div>
            <span className="badge" aria-label={`Current ${trend.label} ${trend.value}${trend.unit}`}>
              {trend.value}
              {trend.unit}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

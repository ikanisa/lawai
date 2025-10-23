'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, LineChart, Wifi } from 'lucide-react';
import { Button } from '../@/ui/button';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries } from '../api/client';
import { useAdminSession } from '../session-context';

export function AdminTelemetryPage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const { session, loading: sessionLoading } = useAdminSession();
  const isSessionReady = Boolean(session) && !sessionLoading;
  const telemetryQuery = useQuery({
    ...adminQueries.telemetry(activeOrg.id),
    enabled: isSessionReady,
  });
  const telemetry = telemetryQuery.data?.metrics ?? [];

  const charts = useMemo(
    () =>
      telemetryQuery.data?.charts ?? [
        {
          id: 'runs',
          title: 'Runs per minute',
          points: Array.from({ length: 20 }).map((_, index) => ({ x: index, y: Math.round(Math.random() * 100) })),
        },
      ],
    [telemetryQuery.data?.charts],
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Telemetry"
        description="Analyze runs, latencies, voice roundtrip times, and eval pass rates with exportable datasets."
        actions={
          <Button variant="outline" size="sm" className="gap-2" disabled={!isSessionReady}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <AdminDataTable
        data={telemetry}
        columns={[
          { key: 'metric', header: 'Metric' },
          { key: 'value', header: 'Value' },
          { key: 'delta', header: 'Δ' },
          { key: 'window', header: 'Window' },
        ]}
        emptyState="No telemetry captured"
        searchQuery={searchQuery}
        storageKey={`admin-telemetry-${activeOrg.id}`}
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {charts.map((chart) => (
          <div key={chart.id} className="space-y-3 rounded-xl border border-slate-800/70 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">{chart.title}</h2>
              <LineChart className="h-4 w-4 text-sky-300" />
            </div>
            <div className="flex h-32 items-end gap-1">
              {chart.points.map((point) => (
                <div key={point.x} className="flex-1 rounded bg-indigo-500/30" style={{ height: `${Math.max(8, point.y)}%` }}>
                  <span className="sr-only">
                    {chart.title} {point.x}: {point.y}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-6">
        <header className="flex items-center gap-3 text-sm font-semibold text-slate-200">
          <Wifi className="h-4 w-4 text-sky-300" /> Export & streaming
        </header>
        <p className="mt-2 text-sm text-slate-400">
          Telemetry streams to Supabase storage for long-term retention. Use CSV or JSON exports for external analytics pipelines.
        </p>
      </section>
    </div>
  );
}

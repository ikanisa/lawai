'use client';

import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Play } from 'lucide-react';
import { Button } from '../@/ui/button';
import { Badge } from '../@/ui/badge';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries, triggerAdminJob } from '../api/client';

const FALLBACK_STATS = [
  { id: 'runs', label: 'Agent runs (24h)', value: 1284, trend: 12, unit: '%' },
  { id: 'evals', label: 'Evals pass rate', value: 92, trend: -3, unit: '%' },
  { id: 'ingestion', label: 'Ingestion freshness', value: 4, trend: 1, unit: 'h' },
  { id: 'sla', label: 'SLO compliance', value: 99.1, trend: 1.2, unit: '%' },
];

export function AdminOverviewPage() {
  const { activeOrg } = useAdminPanelContext();
  const overviewQuery = useQuery(adminQueries.overview(activeOrg.id));
  const jobsQuery = useQuery(adminQueries.jobs(activeOrg.id));

  const stats = overviewQuery.data?.stats ?? FALLBACK_STATS;
  const charts = overviewQuery.data?.charts ?? [];
  const alerts = overviewQuery.data?.alerts ?? [];
  const jobs = jobsQuery.data?.jobs ?? [];

  const chartPlaceholders = useMemo(() => {
    if (charts.length > 0) return charts;
    return [
      {
        id: 'runs',
        title: 'Runs per hour',
        points: Array.from({ length: 12 }).map((_, index) => ({ x: `${index}h`, y: Math.round(Math.random() * 100) })),
      },
      {
        id: 'evals',
        title: 'Eval pass rate',
        points: Array.from({ length: 12 }).map((_, index) => ({ x: `${index}h`, y: Math.round(80 + Math.random() * 20) })),
      },
    ];
  }, [charts]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Overview"
        description="Centralized health view for your tenant. Track runs, ingestion freshness, eval status, and policy alerts."
        actions={
          <Button size="sm" className="gap-2" onClick={() => void triggerAdminJob('eval-nightly', activeOrg.id)}>
            <Play className="h-4 w-4" /> Trigger nightly eval
          </Button>
        }
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.id}
            layout
            className="rounded-lg border border-slate-800/60 bg-slate-950/40 p-4"
            transition={{ type: 'spring', stiffness: 140, damping: 18 }}
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-50">
              {stat.value}
              {stat.unit && <span className="ml-1 text-base text-slate-400">{stat.unit}</span>}
            </p>
            <p className={`mt-1 text-xs ${stat.trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stat.trend >= 0 ? '+' : ''}
              {stat.trend}% vs previous period
            </p>
          </motion.div>
        ))}
      </AdminPageHeader>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Metric charts">
        {chartPlaceholders.map((chart) => (
          <div key={chart.id} className="space-y-3 rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200">{chart.title}</h2>
              <Badge variant="outline">Last 12h</Badge>
            </div>
            <div className="flex h-36 items-end justify-between gap-1">
              {chart.points.map((point) => (
                <motion.div
                  key={point.x}
                  layout
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(8, point.y)}%` }}
                  transition={{ duration: 0.4, delay: 0.01 }}
                  className="flex-1 rounded bg-sky-500/30"
                >
                  <span className="sr-only">
                    {chart.title} {point.x}: {point.y}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Alerts and jobs">
        <div className="space-y-3 rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Alerts</h2>
            <Badge variant="warning">{alerts.length || '0'}</Badge>
          </div>
          <ul className="space-y-2 text-sm">
            {(alerts.length > 0 ? alerts : [{ id: 'ok', severity: 'info', summary: 'No active incidents' }]).map((alert) => (
              <li
                key={alert.id}
                className={`rounded-lg border px-3 py-2 ${
                  alert.severity === 'critical'
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                    : alert.severity === 'warning'
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                      : 'border-slate-700/60 bg-slate-900/70 text-slate-200'
                }`}
              >
                {alert.summary}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-800/60 bg-slate-900/50 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Jobs</h2>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void triggerAdminJob('drive-watch', activeOrg.id)}>
              <Sparkles className="h-4 w-4" /> Run Drive watcher
            </Button>
          </div>
          <AdminDataTable
            data={jobs}
            columns={[
              { key: 'id', header: 'Job ID' },
              { key: 'type', header: 'Type' },
              { key: 'status', header: 'Status' },
              {
                key: 'progress',
                header: 'Progress',
                render: (row) => <span className="font-medium text-sky-300">{row.progress}%</span>,
              },
              { key: 'updatedAt', header: 'Updated', align: 'right' },
            ]}
            emptyState="No jobs scheduled"
          />
        </div>
      </section>
    </div>
  );
}

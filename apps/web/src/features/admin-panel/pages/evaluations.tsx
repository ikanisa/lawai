'use client';

import { useQuery } from '@tanstack/react-query';
import { Flag, RefreshCcw, TrendingUp } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries } from '../api/client';
import { useAdminSession } from '../session-context';

export function AdminEvaluationsPage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const { session, loading: sessionLoading } = useAdminSession();
  const isSessionReady = Boolean(session) && !sessionLoading;
  const evalQuery = useQuery({
    ...adminQueries.evaluations(activeOrg.id),
    enabled: isSessionReady,
  });
  const evals = evalQuery.data?.evaluations ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Evaluations"
        description="Monitor nightly datasets, SLO gates, and rollback workflows for regressions."
        actions={
          <Button variant="outline" size="sm" className="gap-2" disabled={!isSessionReady}>
            <RefreshCcw className="h-4 w-4" /> Re-run now
          </Button>
        }
      />

      <AdminDataTable
        data={evals}
        columns={[
          { key: 'name', header: 'Dataset' },
          { key: 'status', header: 'Status' },
          { key: 'passRate', header: 'Pass rate', render: (row) => `${row.passRate}%` },
          { key: 'sloGate', header: 'SLO gate' },
          { key: 'lastRunAt', header: 'Last run' },
        ]}
        emptyState="No evaluations configured"
        searchQuery={searchQuery}
        storageKey={`admin-evals-${activeOrg.id}`}
      />

      <section className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-6">
        <header className="flex items-center gap-3 text-sm font-semibold text-slate-200">
          <TrendingUp className="h-4 w-4 text-sky-300" /> Regression triage
        </header>
        <p className="mt-2 text-sm text-slate-400">
          Nightly regressions automatically halt promotions and file incidents into the audit log. Use rollback controls to revert
          to the previous workflow version.
        </p>
        <Button variant="secondary" size="sm" className="mt-4 gap-2" disabled={!isSessionReady}>
          <Flag className="h-4 w-4" /> Rollback workflow
        </Button>
      </section>
    </div>
  );
}

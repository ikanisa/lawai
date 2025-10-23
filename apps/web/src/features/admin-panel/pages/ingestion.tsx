'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '../@/ui/button';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries, controlIngestion, triggerAdminJob } from '../api/client';
import { useAdminSession } from '../session-context';

export function AdminIngestionPage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const { session, loading: sessionLoading } = useAdminSession();
  const queryClient = useQueryClient();
  const isSessionReady = Boolean(session) && !sessionLoading;
  const ingestionQuery = useQuery({
    ...adminQueries.ingestion(activeOrg.id),
    enabled: isSessionReady,
  });

  const controlMutation = useMutation({
    mutationFn: async (payload: { action: 'start' | 'stop' | 'backfill' }) =>
      controlIngestion(activeOrg.id, payload.action),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.ingestion(activeOrg.id).queryKey });
      void queryClient.invalidateQueries({ queryKey: adminQueries.jobs(activeOrg.id).queryKey });
    },
  });

  const tasks = ingestionQuery.data?.tasks ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Ingestion"
        description="Control backfills, OCR pipelines, and ingestion error remediation jobs."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => controlMutation.mutate({ action: 'backfill' })}
              disabled={!isSessionReady || controlMutation.isPending}
            >
              <RotateCcw className="h-4 w-4" /> Start backfill
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => controlMutation.mutate({ action: 'start' })}
              disabled={!isSessionReady || controlMutation.isPending}
            >
              <Play className="h-4 w-4" /> Start pipeline
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => controlMutation.mutate({ action: 'stop' })}
              disabled={!isSessionReady || controlMutation.isPending}
            >
              <Pause className="h-4 w-4" /> Stop
            </Button>
          </div>
        }
      />

      <AdminDataTable
        data={tasks}
        columns={[
          { key: 'id', header: 'Task' },
          { key: 'stage', header: 'Stage' },
          { key: 'status', header: 'Status' },
          { key: 'progress', header: 'Progress', render: (row) => `${row.progress}%` },
          { key: 'updatedAt', header: 'Updated at' },
          {
            key: 'lastError',
            header: 'Last error',
            render: (row) => row.lastError ?? '—',
          },
        ]}
        emptyState="No ingestion tasks"
        searchQuery={searchQuery}
        storageKey={`admin-ingestion-${activeOrg.id}`}
      />

      <section className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-6">
        <header className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> Job progress
        </header>
        <p className="mt-2 text-sm text-slate-400">
          Long-running OCR and vectorization stages emit progress to the job queue. The UI polls /api/admin/jobs for updates with
          SSE fallback planned.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={() => void triggerAdminJob('ingestion', activeOrg.id)}
          disabled={!isSessionReady}
        >
          <Play className="h-4 w-4" /> Trigger ingestion job
        </Button>
      </section>
    </div>
  );
}

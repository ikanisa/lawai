'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, RotateCcw, FileDiff, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries } from '../api/client';
import { Sheet, SheetSection } from '../../../components/ui/sheet';

export function AdminWorkflowsPage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const queryClient = useQueryClient();
  const workflowsQuery = useQuery(adminQueries.workflows(activeOrg.id));
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const workflows = workflowsQuery.data?.workflows ?? [];
  const selectedWorkflow = selectedWorkflowId
    ? workflows.find((workflow) => workflow.id === selectedWorkflowId)
    : undefined;

  const promoteMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: activeOrg.id, action: 'promote', payload: { workflowId } }),
      });
      if (!response.ok) {
        throw new Error('Failed to promote workflow');
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.workflows(activeOrg.id).queryKey });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: activeOrg.id, action: 'rollback', payload: { workflowId } }),
      });
      if (!response.ok) {
        throw new Error('Failed to rollback workflow');
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.workflows(activeOrg.id).queryKey });
    },
  });

  const confirmPromote = (workflowId: string) => {
    if (window.confirm('Promote workflow to production? Previous version will be archived.')) {
      promoteMutation.mutate(workflowId);
    }
  };

  const confirmRollback = (workflowId: string) => {
    if (window.confirm('Rollback workflow to staging version? This will halt active runs.')) {
      rollbackMutation.mutate(workflowId);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Workflows"
        description="Version and promote complex orchestration graphs with auditability and rollback controls."
      />

      <AdminDataTable
        data={workflows}
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'version', header: 'Version' },
          { key: 'status', header: 'Status' },
          { key: 'updatedAt', header: 'Updated' },
        ]}
        emptyState="No workflows configured"
        searchQuery={searchQuery}
        storageKey={`admin-workflows-${activeOrg.id}`}
        onRowSelect={(row) => setSelectedWorkflowId(row.id as string)}
      />

      <Sheet
        open={Boolean(selectedWorkflow)}
        onOpenChange={(open) => {
          if (!open) setSelectedWorkflowId(null);
        }}
        title={selectedWorkflow ? selectedWorkflow.name : 'Workflow details'}
        description="Review diff, blast radius, and promotion history before rolling changes out."
      >
        {selectedWorkflow && (
          <>
            <SheetSection className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Current status</span>
                <span className="rounded-full border border-slate-700/60 px-3 py-1 text-xs uppercase tracking-wide">
                  {selectedWorkflow.status}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                Last updated {new Date(selectedWorkflow.updatedAt).toLocaleString()} (version{' '}
                <strong>{selectedWorkflow.version}</strong>)
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Blast radius: Updating will restart {selectedWorkflow.status === 'production' ? 'live matters' : 'staging flows'}.
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => confirmPromote(selectedWorkflow.id)}
                  disabled={promoteMutation.isPending || selectedWorkflow.status === 'production'}
                >
                  <ArrowUpRight className="h-4 w-4" /> Promote to production
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => confirmRollback(selectedWorkflow.id)}
                  disabled={rollbackMutation.isPending || selectedWorkflow.status !== 'production'}
                >
                  <RotateCcw className="h-4 w-4" /> Rollback
                </Button>
              </div>
            </SheetSection>

            <SheetSection>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
                <FileDiff className="h-4 w-4 text-sky-300" /> Diff preview
              </h2>
              <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800/60 bg-slate-950/60 p-4 text-xs text-slate-300">
                {selectedWorkflow.diff ?? '{\n  "summary": "No draft diff provided"\n}'}
              </pre>
            </SheetSection>
          </>
        )}
      </Sheet>
    </div>
  );
}

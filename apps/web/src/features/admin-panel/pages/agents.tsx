'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlayCircle, TestTube2, Wrench, Sparkles } from 'lucide-react';
import { Button } from '@avocat-ai/ui';
import { Textarea } from '@avocat-ai/ui';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries, updateWorkflowStatus } from '../api/client';
import { useAdminSession } from '../session-context';
import { Sheet, SheetSection } from '../../../components/ui/sheet';

export function AdminAgentsPage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const { session, loading: sessionLoading } = useAdminSession();
  const queryClient = useQueryClient();
  const isSessionReady = Boolean(session) && !sessionLoading;
  const agentsQuery = useQuery({
    ...adminQueries.agents(activeOrg.id),
    enabled: isSessionReady,
  });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [testPrompt, setTestPrompt] = useState('Test how the drafting agent summarizes last 3 filings for Matter-42.');

  const agents = agentsQuery.data?.agents ?? [];
  const selectedAgent = selectedAgentId
    ? agents.find((agent) => agent.id === selectedAgentId)
    : undefined;

  const promoteMutation = useMutation({
    mutationFn: async (agentId: string) => updateWorkflowStatus(activeOrg.id, 'promote', agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.workflows(activeOrg.id).queryKey });
    },
  });

  const runTest = () => {
    window.alert(`Executing test run for ${selectedAgent?.name ?? 'agent'} with prompt: ${testPrompt}`);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Agents & Tools"
        description="Manage agent versions, connected tools, and run test executions before promotion."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSelectedAgentId(agents[0]?.id ?? null)}
            disabled={agents.length === 0 || !isSessionReady}
          >
            <TestTube2 className="h-4 w-4" /> Run test
          </Button>
        }
      />

      <AdminDataTable
        data={agents}
        columns={[
          { key: 'name', header: 'Agent' },
          { key: 'version', header: 'Version' },
          { key: 'toolCount', header: 'Tools' },
          { key: 'status', header: 'Status' },
          { key: 'promotedAt', header: 'Promoted at' },
        ]}
        emptyState="No agents configured"
        searchQuery={searchQuery}
        storageKey={`admin-agents-${activeOrg.id}`}
        onRowSelect={(row) => setSelectedAgentId(row.id as string)}
      />

      <Sheet
        open={Boolean(selectedAgent)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedAgentId(null);
          }
        }}
        title={selectedAgent ? selectedAgent.name : 'Agent details'}
        description="Inspect tool configuration, last promotion details, and execute smoke tests before rollout."
      >
        {selectedAgent && (
          <>
            <SheetSection>
              <dl className="grid grid-cols-2 gap-3 text-sm text-slate-300">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Version</dt>
                  <dd className="font-medium text-slate-100">{selectedAgent.version}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Tools</dt>
                  <dd>{selectedAgent.toolCount}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
                  <dd className="capitalize">{selectedAgent.status}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Promoted</dt>
                  <dd>{new Date(selectedAgent.promotedAt).toLocaleString()}</dd>
                </div>
              </dl>
            </SheetSection>

            <SheetSection className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-200">Pre-promotion test</h2>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => promoteMutation.mutate(selectedAgent.id)}
                  disabled={!isSessionReady || promoteMutation.isPending}
                >
                  <Sparkles className="h-4 w-4" /> Promote to production
                </Button>
              </div>
              <Textarea
                className="min-h-[180px] bg-slate-900/80"
                value={testPrompt}
                onChange={(event) => setTestPrompt(event.target.value)}
              />
              <Button className="gap-2" onClick={runTest}>
                <PlayCircle className="h-4 w-4" /> Execute test
              </Button>
            </SheetSection>

            <SheetSection>
              <h2 className="text-sm font-semibold text-slate-200">Connected tools</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {Array.from({ length: selectedAgent.toolCount }).map((_, index) => (
                  <li key={index} className="rounded-lg border border-slate-800/60 bg-slate-950/40 px-3 py-2">
                    <Wrench className="mr-2 inline h-4 w-4 text-sky-300" aria-hidden /> Tool #{index + 1}
                  </li>
                ))}
              </ul>
            </SheetSection>
          </>
        )}
      </Sheet>
    </div>
  );
}

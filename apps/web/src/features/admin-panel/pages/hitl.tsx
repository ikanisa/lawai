'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, MessageSquareWarning, XCircle } from 'lucide-react';
import { Button } from '../@/ui/button';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries, recordHitlDecision } from '../api/client';
import { useAdminSession } from '../session-context';
import { Sheet, SheetSection } from '../../../components/ui/sheet';

export function AdminHitlPage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const { session, loading: sessionLoading } = useAdminSession();
  const queryClient = useQueryClient();
  const isSessionReady = Boolean(session) && !sessionLoading;
  const hitlQuery = useQuery({
    ...adminQueries.hitl(activeOrg.id),
    enabled: isSessionReady,
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const queue = hitlQuery.data?.queue ?? [];
  const selectedItem = selectedItemId ? queue.find((item) => item.id === selectedItemId) : undefined;

  const reviewMutation = useMutation({
    mutationFn: async (payload: { id: string; action: 'approved' | 'revision-requested' | 'rejected' }) =>
      recordHitlDecision(activeOrg.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.hitl(activeOrg.id).queryKey });
      setSelectedItemId(null);
    },
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="HITL Review"
        description="Triage the live review queue with IRAC summaries, source diffs, and blast radius estimates."
      />

      <AdminDataTable
        data={queue}
        columns={[
          { key: 'id', header: 'ID' },
          { key: 'matter', header: 'Matter' },
          { key: 'status', header: 'Status' },
          { key: 'submittedAt', header: 'Submitted' },
        ]}
        emptyState="Queue is clear"
        searchQuery={searchQuery}
        storageKey={`admin-hitl-${activeOrg.id}`}
        onRowSelect={(row) => setSelectedItemId(row.id as string)}
      />

      <Sheet
        open={Boolean(selectedItem)}
        onOpenChange={(open) => {
          if (!open) setSelectedItemId(null);
        }}
        title={selectedItem ? `Review ${selectedItem.matter}` : 'HITL review'}
        description="Verify IRAC summary and approve or request changes before releasing to the tenant."
      >
        {selectedItem && (
          <>
            <SheetSection className="space-y-3 text-sm text-slate-300">
              <p className="text-xs uppercase tracking-wide text-slate-500">Summary</p>
              <p>{selectedItem.summary}</p>
              <p className="text-xs text-slate-500">Blast radius: {selectedItem.blastRadius} impacted matters</p>
              <p className="text-xs text-slate-500">
                Submitted {new Date(selectedItem.submittedAt).toLocaleString()} · Current status{' '}
                <strong className="capitalize">{selectedItem.status}</strong>
              </p>
            </SheetSection>

            <SheetSection className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-200">IRAC preview</h2>
              <div className="space-y-2 rounded-lg border border-slate-800/60 bg-slate-950/50 p-4 text-xs text-slate-300">
                <p><strong>Issue:</strong> Confirm citation accuracy for appended exhibit.</p>
                <p><strong>Rule:</strong> Apply residency guardrails and ensure GDPR references align.</p>
                <p>
                  <strong>Analysis:</strong> Model referenced previous filings and cross-checked with corpus snapshots. Highlighted two
                  conflicting precedents requiring manual confirmation.
                </p>
                <p><strong>Conclusion:</strong> Recommend approving with additional reviewer note on residency clause.</p>
              </div>
            </SheetSection>

            <SheetSection className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => reviewMutation.mutate({ id: selectedItem.id, action: 'approved' })}
                  disabled={!isSessionReady || reviewMutation.isPending}
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  onClick={() => reviewMutation.mutate({ id: selectedItem.id, action: 'revision-requested' })}
                  disabled={!isSessionReady || reviewMutation.isPending}
                >
                  <MessageSquareWarning className="h-4 w-4" /> Request changes
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2"
                  onClick={() => reviewMutation.mutate({ id: selectedItem.id, action: 'rejected' })}
                  disabled={!isSessionReady || reviewMutation.isPending}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
              </div>
              <Button variant="ghost" size="sm" className="gap-2 self-start">
                <ArrowRight className="h-4 w-4" /> Open full review surface
              </Button>
            </SheetSection>
          </>
        )}
      </Sheet>
    </div>
  );
}

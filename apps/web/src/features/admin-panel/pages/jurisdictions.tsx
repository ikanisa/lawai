'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Globe2, UploadCloud } from 'lucide-react';
import { Button } from '@/ui/button';
import { Switch } from '@/ui/switch';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries } from '../api/client';

export function AdminJurisdictionsPage() {
  const { activeOrg } = useAdminPanelContext();
  const queryClient = useQueryClient();
  const entitlementsQuery = useQuery(adminQueries.jurisdictions(activeOrg.id));

  const toggleMutation = useMutation({
    mutationFn: async (payload: { jurisdiction: string; entitlement: string; enabled: boolean }) => {
      const response = await fetch('/api/admin/jurisdictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: activeOrg.id, action: 'toggle', payload }),
      });
      if (!response.ok) {
        throw new Error('Failed to update entitlement');
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.jurisdictions(activeOrg.id).queryKey });
    },
  });

  const rows = entitlementsQuery.data?.entitlements ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Jurisdictions & Entitlements"
        description="Control availability of corpora, workflows, and agents by jurisdiction."
        actions={
          <Button variant="outline" size="sm" className="gap-2">
            <UploadCloud className="h-4 w-4" /> Import matrix
          </Button>
        }
      />

      <AdminDataTable
        data={rows}
        columns={[
          { key: 'jurisdiction', header: 'Jurisdiction' },
          { key: 'entitlement', header: 'Entitlement' },
          {
            key: 'enabled',
            header: 'Enabled',
            render: (row) => (
              <Switch
                checked={row.enabled}
                onCheckedChange={(next) =>
                  toggleMutation.mutate({
                    jurisdiction: row.jurisdiction,
                    entitlement: row.entitlement,
                    enabled: next,
                  })
                }
                aria-label={`Toggle ${row.entitlement} for ${row.jurisdiction}`}
              />
            ),
            align: 'center',
          },
          { key: 'updatedAt', header: 'Updated at' },
        ]}
        emptyState="No entitlements configured"
        filterLabel="Filter entitlements"
      />

      <section className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-6">
        <header className="flex items-center gap-3 text-sm font-semibold text-slate-200">
          <Globe2 className="h-4 w-4 text-sky-300" /> Residency guardrails
        </header>
        <p className="mt-3 text-sm text-slate-400">
          Configure data residency per jurisdiction. Supabase storage paths are automatically prefixed by organization and
          jurisdiction for storage policies.
        </p>
      </section>
    </div>
  );
}

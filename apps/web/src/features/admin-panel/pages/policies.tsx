'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Undo2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries } from '../api/client';

export function AdminPoliciesPage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const queryClient = useQueryClient();
  const policyQuery = useQuery(adminQueries.policies(activeOrg.id));

  const upsertMutation = useMutation({
    mutationFn: async (payload: { key: string; value: unknown }) => {
      const response = await fetch('/api/admin/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: activeOrg.id, action: 'upsert', payload }),
      });
      if (!response.ok) {
        throw new Error('Failed to update policy');
      }
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.policies(activeOrg.id).queryKey });
    },
  });

  const policies = policyQuery.data?.policies ?? [];
  const featureFlags = useMemo(
    () =>
      policies.filter((policy) => policy.key.startsWith('feature:')).map((policy) => ({
        key: policy.key,
        enabled: Boolean(policy.value === true || policy.value === 'on'),
      })),
    [policies],
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Policies"
        description="Manage feature flags, residency guardrails, and configuration versions with audit-ready rollbacks."
        actions={
          <Button size="sm" variant="outline" className="gap-2">
            <Undo2 className="h-4 w-4" /> Rollback latest change
          </Button>
        }
      />

      <section className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-900/50 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Feature flags</h2>
            <p className="text-xs text-slate-500">Toggle guardrails and experimental capabilities with optimistic updates.</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-sky-300" />
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          {featureFlags.length === 0 && <p className="text-sm text-slate-500">No feature flags defined for this tenant.</p>}
          {featureFlags.map((flag) => (
            <label
              key={flag.key}
              className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-4"
            >
              <span className="text-sm font-medium text-slate-200">{flag.key.replace('feature:', '')}</span>
              <Switch
                checked={flag.enabled}
                onCheckedChange={(next) =>
                  upsertMutation.mutate({ key: flag.key, value: next ? 'on' : 'off' })
                }
                aria-label={`Toggle ${flag.key}`}
              />
            </label>
          ))}
        </div>
      </section>

      <AdminDataTable
        data={policies}
        columns={[
          { key: 'key', header: 'Key' },
          { key: 'value', header: 'Value' },
          { key: 'updatedBy', header: 'Updated by' },
          { key: 'updatedAt', header: 'Updated at' },
        ]}
        emptyState="No policies configured"
        searchQuery={searchQuery}
        storageKey={`admin-policies-${activeOrg.id}`}
      />
    </div>
  );
}

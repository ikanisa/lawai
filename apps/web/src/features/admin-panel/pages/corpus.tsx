'use client';

import { useQuery } from '@tanstack/react-query';
import { Database, UploadCloud, Shield } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries } from '../api/client';

export function AdminCorpusPage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const corpusQuery = useQuery(adminQueries.corpus(activeOrg.id));
  const sources = corpusQuery.data?.sources ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Corpus & Sources"
        description="Monitor Drive connectors, allowlists, and quarantined documents with storage snapshots."
        actions={
          <Button variant="outline" size="sm" className="gap-2">
            <UploadCloud className="h-4 w-4" /> Trigger snapshot
          </Button>
        }
      />

      <AdminDataTable
        data={sources}
        columns={[
          { key: 'label', header: 'Source' },
          { key: 'status', header: 'Status' },
          { key: 'lastSyncedAt', header: 'Last synced' },
          { key: 'quarantineCount', header: 'Quarantine' },
        ]}
        emptyState="No sources connected"
        searchQuery={searchQuery}
        storageKey={`admin-corpus-${activeOrg.id}`}
      />

      <section className="rounded-xl border border-slate-800/70 bg-slate-900/50 p-6">
        <header className="flex items-center gap-3 text-sm font-semibold text-slate-200">
          <Database className="h-4 w-4 text-sky-300" /> Vector store readiness
        </header>
        <p className="mt-2 text-sm text-slate-400">
          Embeddings mirror into the Supabase vector table with an HNSW index for fast retrieval. Storage buckets are scoped per
          org with prefix policies.
        </p>
        <div className="mt-4 rounded-lg border border-slate-800/60 bg-slate-950/40 p-4 text-sm text-slate-300">
          <p className="font-semibold">Quarantine policy</p>
          <p className="text-xs text-slate-500">Files exceeding residency or guardrail checks are placed into quarantine buckets until reviewed.</p>
        </div>
      </section>

      <Button variant="secondary" size="sm" className="gap-2">
        <Shield className="h-4 w-4" /> Manage allowlist
      </Button>
    </div>
  );
}

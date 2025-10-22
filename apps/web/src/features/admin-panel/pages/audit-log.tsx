'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileJson } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries } from '../api/client';

const PLACEHOLDER_EVENTS = [
  {
    id: 'evt-1',
    actor: 'alex@demo.org',
    action: 'policy.updated',
    object: 'feature:ingestion-ocr',
    createdAt: '2024-07-09T03:15:00Z',
  },
];

export function AdminAuditLogPage() {
  const { activeOrg } = useAdminPanelContext();
  const [search, setSearch] = useState('');
  const auditQuery = useQuery(adminQueries.audit(activeOrg.id));
  const events = auditQuery.data?.events ?? PLACEHOLDER_EVENTS;

  const filtered = useMemo(() => {
    if (!search) return events;
    const lower = search.toLowerCase();
    return events.filter((event) => Object.values(event).some((value) => String(value).toLowerCase().includes(lower)));
  }, [events, search]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit log"
        description="Search by actor, action, object, or timestamp. Export JSON diffs for compliance."
        actions={
          <Button variant="outline" size="sm" className="gap-2">
            <FileJson className="h-4 w-4" /> Export JSON
          </Button>
        }
      />

      <div className="flex items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-900/50 p-4">
        <Search className="h-5 w-5 text-slate-400" />
        <Input
          placeholder="Search audit events"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="bg-slate-900/70"
        />
      </div>

      <AdminDataTable
        data={filtered}
        columns={[
          { key: 'createdAt', header: 'Timestamp' },
          { key: 'actor', header: 'Actor' },
          { key: 'action', header: 'Action' },
          { key: 'object', header: 'Object' },
        ]}
        emptyState="No audit events found"
      />
    </div>
  );
}

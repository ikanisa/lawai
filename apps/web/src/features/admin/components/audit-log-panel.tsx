import type { GovernanceMetricsResponse } from '@/lib/api';
import type { Messages } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@avocat-ai/ui';

import { formatDateTime } from '../utils/formatters';

interface AuditEvent {
  id: string;
  kind: string;
  object: string;
  created_at: string;
  actor_user_id?: string | null;
}

export interface AdminAuditLogPanelProps {
  loading: boolean;
  events: AuditEvent[];
  messages: Messages['admin'];
}

export function AdminAuditLogPanel({ loading, events, messages }: AdminAuditLogPanelProps) {
  return (
    <Card className="glass-card border border-slate-800/60 xl:col-span-2">
      <CardHeader>
        <CardTitle className="text-slate-100">{messages.auditTitle}</CardTitle>
        <p className="text-sm text-slate-400">{messages.auditDescription}</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-400">{messages.loadingShort}</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-slate-400">{messages.auditEmpty}</p>
        ) : (
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-2 pr-4">{messages.auditEvent}</th>
                <th className="py-2 pr-4">{messages.auditObject}</th>
                <th className="py-2 pr-4">{messages.auditActor}</th>
                <th className="py-2">{messages.auditDate}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="py-2 pr-4 font-medium text-slate-100">{event.kind}</td>
                  <td className="py-2 pr-4 text-slate-300">{event.object}</td>
                  <td className="py-2 pr-4 text-slate-400">{event.actor_user_id ?? messages.auditSystem}</td>
                  <td className="py-2 text-slate-400">{formatDateTime(event.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

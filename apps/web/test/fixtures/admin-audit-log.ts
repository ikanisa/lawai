import type { Messages } from '@/lib/i18n';
import type { AdminAuditLogPanelProps } from '@/features/admin/components/audit-log-panel';
import messagesEn from '../../messages/en.json';

const defaultMessages = (messagesEn as Messages).admin;

const baseProps: AdminAuditLogPanelProps = {
  loading: false,
  messages: defaultMessages,
  events: [
    {
      id: 'audit-1',
      kind: 'user.login',
      object: 'user:123',
      actor_user_id: 'user@example.com',
      created_at: '2024-05-01T10:00:00Z',
    },
    {
      id: 'audit-2',
      kind: 'policy.updated',
      object: 'policy:incident_response',
      actor_user_id: null,
      created_at: '2024-05-02T12:30:00Z',
    },
  ],
};

export function createAdminAuditLogProps(
  overrides: Partial<AdminAuditLogPanelProps> = {},
): AdminAuditLogPanelProps {
  return {
    loading: overrides.loading ?? baseProps.loading,
    messages: overrides.messages ?? baseProps.messages,
    events: overrides.events ?? baseProps.events,
  } satisfies AdminAuditLogPanelProps;
}

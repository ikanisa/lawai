'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, RefreshCcw, Save } from 'lucide-react';
import { Button } from '../@/ui/button';
import { Switch } from '../@/ui/switch';
import { AdminPageHeader } from '../components/page-header';
import { AdminDataTable } from '../components/data-table';
import { useAdminPanelContext } from '../context';
import { adminQueries, inviteAdminUser, updateAdminUser } from '../api/client';
import { useAdminSession } from '../session-context';
import { Sheet, SheetSection } from '../../../components/ui/sheet';

interface InvitationPayload {
  email: string;
  role: string;
}

export function AdminPeoplePage() {
  const { activeOrg, searchQuery } = useAdminPanelContext();
  const { session, loading: sessionLoading } = useAdminSession();
  const queryClient = useQueryClient();
  const isSessionReady = Boolean(session) && !sessionLoading;
  const peopleQuery = useQuery({
    ...adminQueries.people(activeOrg.id),
    enabled: isSessionReady,
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const selectedUser = useMemo(
    () => peopleQuery.data?.users.find((user) => user.id === selectedUserId) ?? null,
    [peopleQuery.data?.users, selectedUserId],
  );
  const [draftRole, setDraftRole] = useState<string>('');
  const [draftCapabilities, setDraftCapabilities] = useState<string[]>([]);

  const inviteMutation = useMutation({
    mutationFn: async (payload: InvitationPayload) => inviteAdminUser(activeOrg.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.people(activeOrg.id).queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; role: string; capabilities: string[] }) =>
      updateAdminUser(activeOrg.id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminQueries.people(activeOrg.id).queryKey });
      setSelectedUserId(null);
    },
  });

  const users = peopleQuery.data?.users ?? [];

  const openEditor = (userId: string) => {
    setSelectedUserId(userId);
    const user = users.find((entry) => entry.id === userId);
    if (user) {
      setDraftRole(user.role);
      setDraftCapabilities(user.capabilities);
    }
  };

  const toggleCapability = (capability: string) => {
    setDraftCapabilities((previous) =>
      previous.includes(capability)
        ? previous.filter((item) => item !== capability)
        : [...previous, capability],
    );
  };

  const invite = (role: string) => {
    const email = window.prompt('Email to invite');
    if (!email) return;
    inviteMutation.mutate({ email, role });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="People"
        description="Manage users, roles, invitations, and active sessions across your organization."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => invite('member')}
              disabled={!isSessionReady || inviteMutation.isPending}
            >
              <Plus className="h-4 w-4" /> Invite user
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="gap-2"
              onClick={() => invite('auditor')}
              disabled={!isSessionReady || inviteMutation.isPending}
            >
              <Shield className="h-4 w-4" /> Create auditor
            </Button>
          </div>
        }
      />

      <AdminDataTable
        data={users}
        columns={[
          { key: 'email', header: 'Email' },
          { key: 'role', header: 'Role' },
          { key: 'lastActive', header: 'Last active' },
          { key: 'invitedAt', header: 'Invited' },
        ]}
        emptyState="No users found"
        searchQuery={searchQuery}
        storageKey={`admin-people-${activeOrg.id}`}
        onRowSelect={(row) => openEditor(row.id as string)}
      />

      <section className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-900/50 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-200">Session controls</h2>
            <p className="text-xs text-slate-500">Toggle session hardening and device trust requirements per org.</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" disabled={!isSessionReady}>
            <RefreshCcw className="h-4 w-4" /> Refresh sessions
          </Button>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-4">
            <span className="text-sm text-slate-200">Require WebAuthn for HITL</span>
            <Switch defaultChecked aria-label="Require WebAuthn" />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-4">
            <span className="text-sm text-slate-200">Session idle timeout (60 min)</span>
            <Switch aria-label="Enable idle timeout" />
          </label>
        </div>
      </section>

      <Sheet
        open={Boolean(selectedUser)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUserId(null);
          }
        }}
        title={selectedUser ? selectedUser.email : 'User editor'}
        description="Adjust role capabilities and review activity before approving changes."
      >
        {selectedUser && (
          <>
            <SheetSection>
              <header className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-200">Role</h2>
                <p className="text-xs text-slate-400">Assign least-privilege access with blast radius awareness.</p>
              </header>
              <select
                className="mt-2 w-full rounded-md border border-slate-700/70 bg-slate-900 px-3 py-2 text-sm"
                value={draftRole}
                onChange={(event) => setDraftRole(event.target.value)}
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="reviewer">Reviewer</option>
                <option value="auditor">Auditor</option>
              </select>
            </SheetSection>

            <SheetSection>
              <header className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-200">Capabilities</h2>
                <p className="text-xs text-slate-400">Toggle granular permissions. Changes emit audit events.</p>
              </header>
              <div className="space-y-3">
                {[
                  { key: 'policies.manage', label: 'Manage feature policies' },
                  { key: 'workflows.promote', label: 'Promote workflows' },
                  { key: 'hitl.review', label: 'Review HITL queue' },
                  { key: 'telemetry.view', label: 'View telemetry exports' },
                ].map((capability) => (
                  <label
                    key={capability.key}
                    className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-950/40 p-3"
                  >
                    <span className="text-sm text-slate-200">{capability.label}</span>
                    <Switch
                      checked={draftCapabilities.includes(capability.key)}
                      onCheckedChange={() => toggleCapability(capability.key)}
                      aria-label={`Toggle capability ${capability.label}`}
                    />
                  </label>
                ))}
              </div>
            </SheetSection>

            <SheetSection className="flex flex-col gap-3">
              <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 p-4 text-sm text-slate-300">
                <p>
                  Last activity:{' '}
                  <strong>{selectedUser.lastActive ? new Date(selectedUser.lastActive).toLocaleString() : 'Never'}</strong>
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Saving updates will produce an audit event and refresh the active sessions list.
                </p>
              </div>
              <Button
                className="gap-2 self-end"
                disabled={updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate({
                    id: selectedUser.id,
                    role: draftRole,
                    capabilities: draftCapabilities,
                  })
                }
              >
                <Save className="h-4 w-4" /> Save &amp; audit
              </Button>
            </SheetSection>
          </>
        )}
      </Sheet>
    </div>
  );
}

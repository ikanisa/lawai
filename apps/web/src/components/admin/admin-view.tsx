'use client';

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { SUPPORTED_JURISDICTIONS } from '@avocat-ai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import {
  DEMO_ORG_ID,
  DEMO_USER_ID,
  fetchGovernanceMetrics,
  type GovernanceMetricsResponse,
  fetchRetrievalMetrics,
  type RetrievalMetricsResponse,
  fetchEvaluationMetrics,
  type EvaluationMetricsResponse,
  fetchSsoConnections,
  saveSsoConnection,
  removeSsoConnection,
  fetchScimTokens,
  createScimAccessToken,
  deleteScimAccessToken,
  fetchOrgMembers,
  createOrgInvite,
  updateMemberRole,
  fetchJurisdictions,
  updateJurisdictions,
  fetchAuditEvents,
  fetchIpAllowlist,
  upsertIpAllowlistEntry,
  deleteIpAllowlistEntry,
  fetchExports,
  fetchDeletionRequests,
  requestExport,
  createDeletionRequest,
  type ScimTokenResponse,
  fetchOperationsOverview,
  type OperationsOverviewResponse,
  fetchOrgPolicies,
  updateOrgPolicies,
  fetchAlerts,
  fetchLearningMetrics,
  fetchLearningSignals,
  fetchAutonomousUserTypes,
} from '../../lib/api';
import type { Locale, Messages } from '../../lib/i18n';
import { OperationsOverviewCard } from '../governance/operations-overview-card';
import { JurisdictionCoverageCard } from '../governance/jurisdiction-coverage-card';

interface AdminViewProps {
  messages: Messages;
  locale: Locale;
}

const selectClassName =
  'focus-ring w-full rounded-2xl border border-slate-600/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-100';

const ADMIN_JURISDICTIONS = ['FR', 'BE', 'LU', 'CH-FR', 'CA-QC', 'MC', 'OHADA', 'MA', 'TN', 'DZ', 'RW', 'EU'];

function useGovernanceMetrics() {
  return useQuery<GovernanceMetricsResponse>({
    queryKey: ['governance-metrics', DEMO_ORG_ID],
    queryFn: () => fetchGovernanceMetrics(DEMO_ORG_ID),
    staleTime: 60_000,
  });
}

export function AdminView({ messages, locale }: AdminViewProps) {
  const queryClient = useQueryClient();
  const metricsQuery = useGovernanceMetrics();
  const operationsQuery = useQuery<OperationsOverviewResponse>({
    queryKey: ['operations-overview', DEMO_ORG_ID],
    queryFn: () => fetchOperationsOverview(DEMO_ORG_ID),
    staleTime: 60_000,
  });
  const policiesQuery = useQuery({ queryKey: ['admin-policies', DEMO_ORG_ID], queryFn: () => fetchOrgPolicies(DEMO_ORG_ID, DEMO_USER_ID) });
  const alertsQuery = useQuery({ queryKey: ['alerts', DEMO_ORG_ID], queryFn: () => fetchAlerts(DEMO_ORG_ID), refetchInterval: 60000 });
  const exportsQuery = useQuery({ queryKey: ['exports', DEMO_ORG_ID], queryFn: () => fetchExports(DEMO_ORG_ID) });
  const deletionQuery = useQuery({ queryKey: ['deletion-requests', DEMO_ORG_ID], queryFn: () => fetchDeletionRequests(DEMO_ORG_ID) });
  const userTypesQuery = useQuery({ queryKey: ['autonomous-user-types'], queryFn: fetchAutonomousUserTypes, staleTime: 300_000 });
  const exportMutation = useMutation({ mutationFn: (fmt: 'csv' | 'json') => requestExport(DEMO_ORG_ID, fmt), onSuccess: () => { toast.success('Export demandé'); queryClient.invalidateQueries({ queryKey: ['exports', DEMO_ORG_ID] }); } });
  const deletionMutation = useMutation({ mutationFn: (payload: { id: string; reason?: string }) => createDeletionRequest(DEMO_ORG_ID, 'document', payload.id, payload.reason), onSuccess: () => { toast.success('Suppression demandée'); queryClient.invalidateQueries({ queryKey: ['deletion-requests', DEMO_ORG_ID] }); } });
  const overview = metricsQuery.data?.overview ?? null;
  const toolRows = metricsQuery.data?.tools ?? [];
  const jurisdictionLabels = useMemo<Map<string, string>>(
    () =>
      new Map<string, string>(
        SUPPORTED_JURISDICTIONS.map((entry: { id: string; labelFr: string }) => [entry.id, entry.labelFr]),
      ),
    [],
  );
  const identifierRows = useMemo(() => {
    const rows = metricsQuery.data?.identifiers ?? [];
    return rows
      .map((row) => ({
        ...row,
        label: jurisdictionLabels.get(row.jurisdiction) ?? row.jurisdiction,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [metricsQuery.data, jurisdictionLabels]);
  const retrievalQuery = useQuery<RetrievalMetricsResponse>({
    queryKey: ['retrieval-metrics', DEMO_ORG_ID],
    queryFn: () => fetchRetrievalMetrics(DEMO_ORG_ID),
    staleTime: 60_000,
  });
  const retrievalSummary = retrievalQuery.data?.summary ?? null;
  const retrievalOrigins = useMemo(() => {
    const origins = retrievalQuery.data?.origins ?? [];
    return origins
      .filter((entry) => entry.snippetCount > 0)
      .sort((a, b) => b.snippetCount - a.snippetCount);
  }, [retrievalQuery.data]);
  const retrievalHosts = useMemo(() => {
    const hosts = retrievalQuery.data?.hosts ?? [];
    return hosts
      .filter((entry) => entry.citationCount > 0)
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 8);
  }, [retrievalQuery.data]);
  const jurisdictionCoverage = metricsQuery.data?.jurisdictions ?? [];
  const intlLocale = locale === 'en' ? 'en-US' : 'fr-FR';
  const numberFormatter = useMemo(() => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0 }), [intlLocale]);
  const decimalFormatter = useMemo(() => new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 1 }), [intlLocale]);
  const dateTimeFormatter = useMemo(
    () => new Intl.DateTimeFormat(intlLocale, { dateStyle: 'short', timeStyle: 'short' }),
    [intlLocale],
  );
  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—';
    return `${decimalFormatter.format(value * 100)} %`;
  };

  const formatMinutes = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—';
    return `${decimalFormatter.format(value)} min`;
  };

  const formatDecimal = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—';
    return decimalFormatter.format(value);
  };

  const formatDateTime = (value: string | null | undefined): string => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return dateTimeFormatter.format(date);
  };
  const evaluationQuery = useQuery<EvaluationMetricsResponse>({
    queryKey: ['evaluation-metrics', DEMO_ORG_ID],
    queryFn: () => fetchEvaluationMetrics(DEMO_ORG_ID),
    staleTime: 60_000,
  });
  const evaluationSummary = evaluationQuery.data?.summary ?? null;
  const evaluationJurisdictions = useMemo(() => {
    const rows = evaluationQuery.data?.jurisdictions ?? [];
    return rows
      .map((row) => ({
        ...row,
        label:
          jurisdictionLabels.get(row.jurisdiction) ??
          (row.jurisdiction === 'UNKNOWN'
            ? messages.admin.evaluationJurisdictionUnknown
            : row.jurisdiction),
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [evaluationQuery.data, jurisdictionLabels, messages.admin.evaluationJurisdictionUnknown]);
  const ssoQuery = useQuery({
    queryKey: ['admin-sso', DEMO_ORG_ID],
    queryFn: () => fetchSsoConnections(DEMO_ORG_ID),
  });
  const scimQuery = useQuery({
    queryKey: ['admin-scim', DEMO_ORG_ID],
    queryFn: () => fetchScimTokens(DEMO_ORG_ID),
  });
  const auditQuery = useQuery({
    queryKey: ['admin-audit', DEMO_ORG_ID],
    queryFn: () => fetchAuditEvents(DEMO_ORG_ID, DEMO_USER_ID, 25),
  });
  const ipQuery = useQuery({
    queryKey: ['admin-ip', DEMO_ORG_ID],
    queryFn: () => fetchIpAllowlist(DEMO_ORG_ID),
  });
  const membersQuery = useQuery({
    queryKey: ['admin-members', DEMO_ORG_ID],
    queryFn: () => fetchOrgMembers(DEMO_ORG_ID, DEMO_USER_ID),
  });
  const members = membersQuery.data?.members ?? [];
  const jurisdictionsQuery = useQuery({
    queryKey: ['admin-jurisdictions', DEMO_ORG_ID],
    queryFn: () => fetchJurisdictions(DEMO_ORG_ID, DEMO_USER_ID),
  });
  const jurisdictionAccess = useMemo(() => {
    const map = new Map<string, { can_read: boolean; can_write: boolean }>();
    for (const entry of jurisdictionsQuery.data?.entitlements ?? []) {
      map.set(entry.juris_code.toUpperCase(), {
        can_read: Boolean(entry.can_read),
        can_write: Boolean(entry.can_write),
      });
    }
    return map;
  }, [jurisdictionsQuery.data]);
  const learningMetricsQuery = useQuery({
    queryKey: ['learning-metrics', DEMO_ORG_ID],
    queryFn: () => fetchLearningMetrics({ limit: 50 }),
    refetchInterval: 60_000,
  });
  const learningSignalsQuery = useQuery({
    queryKey: ['learning-signals', DEMO_ORG_ID],
    queryFn: () => fetchLearningSignals(DEMO_ORG_ID, DEMO_USER_ID, 50),
    refetchInterval: 60_000,
  });

  const learningMetrics = learningMetricsQuery.data?.metrics ?? [];
  const learningSignals = learningSignalsQuery.data?.signals ?? [];
  const allowlistedMetric = learningMetrics.find((metric) => metric.metric === 'citations_allowlisted_ratio');
  const deadLinkMetric = learningMetrics.find((metric) => metric.metric === 'dead_link_rate');
  const learningSignalsDisplayed = learningSignals.slice(0, 10);
  const userTypes = useMemo(() => userTypesQuery.data?.userTypes ?? [], [userTypesQuery.data]);
  const userTypeMap = useMemo(() => {
    const map = new Map<string, { code: string; label: string; defaultRole: string; features: string[] }>();
    for (const entry of userTypes) {
      map.set(entry.code, {
        code: entry.code,
        label: entry.label,
        defaultRole: entry.default_role ?? 'member',
        features: Array.isArray(entry.features) ? entry.features : [],
      });
    }
    return map;
  }, [userTypes]);

  const [ssoProvider, setSsoProvider] = useState<'saml' | 'oidc'>('saml');
  const [ssoLabel, setSsoLabel] = useState('');
  const [ssoAcsUrl, setSsoAcsUrl] = useState('');
  const [ssoEntityId, setSsoEntityId] = useState('');
  const [ssoDefaultRole, setSsoDefaultRole] = useState('member');
  const [scimTokenName, setScimTokenName] = useState('Provisioning');
  const [scimTokenExpires, setScimTokenExpires] = useState('');
  const [lastScimToken, setLastScimToken] = useState<ScimTokenResponse | null>(null);
  const [ipCidr, setIpCidr] = useState('');
  const [ipDescription, setIpDescription] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteUserType, setInviteUserType] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState('member');
  const [latestInvite, setLatestInvite] = useState<{ token: string; expires_at: string } | null>(null);
  const [confidentialMode, setConfidentialMode] = useState(false);
  const [frMode, setFrMode] = useState(true);
  const [sensitiveTopicHitl, setSensitiveTopicHitl] = useState(true);
  const [residencyZone, setResidencyZone] = useState('eu');
  const [deleteDocId, setDeleteDocId] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  useEffect(() => {
    const p = policiesQuery.data?.policies ?? {};
    const conf = (p['confidential_mode'] as any)?.enabled ?? p['confidential_mode'] ?? false;
    const fr = (p['fr_judge_analytics_block'] as any)?.enabled ?? p['fr_judge_analytics_block'] ?? true;
    const sensitive = (p['sensitive_topic_hitl'] as any)?.enabled ?? p['sensitive_topic_hitl'] ?? true;
    const rz = (p['residency_zone'] as any)?.code ?? p['residency_zone'] ?? 'eu';
    setConfidentialMode(Boolean(conf));
    setFrMode(Boolean(fr));
    setSensitiveTopicHitl(Boolean(sensitive ?? true));
    setResidencyZone(typeof rz === 'string' ? rz : 'eu');
  }, [policiesQuery.data]);
  useEffect(() => {
    if (inviteUserType === null && userTypesQuery.data?.userTypes?.length) {
      const first = userTypesQuery.data.userTypes[0];
      setInviteUserType(first.code);
      setInviteRole(first.default_role ?? 'member');
    }
  }, [inviteUserType, userTypesQuery.data]);
  const savePolicies = async () => {
    await updateOrgPolicies(DEMO_ORG_ID, DEMO_USER_ID, [
      { key: 'confidential_mode', value: { enabled: confidentialMode } },
      { key: 'fr_judge_analytics_block', value: { enabled: frMode } },
      { key: 'sensitive_topic_hitl', value: { enabled: sensitiveTopicHitl } },
      { key: 'residency_zone', value: { code: residencyZone } },
    ]);
    toast.success('Politiques mises à jour');
    await queryClient.invalidateQueries({ queryKey: ['admin-policies', DEMO_ORG_ID] });
  };
  const providerLabels = useMemo(
    () => ({
      saml: messages.admin.ssoProviderSaml,
      oidc: messages.admin.ssoProviderOidc,
    }),
    [messages.admin.ssoProviderOidc, messages.admin.ssoProviderSaml],
  );
  const roleOptions = useMemo(
    () => [
      { value: 'owner', label: messages.admin.roleOwner },
      { value: 'admin', label: messages.admin.roleAdmin },
      { value: 'member', label: messages.admin.roleMember },
      { value: 'reviewer', label: messages.admin.roleReviewer },
      { value: 'viewer', label: messages.admin.roleViewer },
      { value: 'compliance_officer', label: messages.admin.roleComplianceOfficer },
      { value: 'auditor', label: messages.admin.roleAuditor },
    ],
    [
      messages.admin.roleAdmin,
      messages.admin.roleAuditor,
      messages.admin.roleComplianceOfficer,
      messages.admin.roleMember,
      messages.admin.roleOwner,
      messages.admin.roleReviewer,
      messages.admin.roleViewer,
    ],
  );
  const inviteUserTypeOptions = useMemo(() => {
    return userTypes.map((entry) => ({
      value: entry.code,
      label: entry.label,
      defaultRole: entry.default_role ?? 'member',
    }));
  }, [userTypes]);
  const selectedUserType = inviteUserType ? userTypeMap.get(inviteUserType) ?? null : null;
  const handleUserTypeChange = (code: string) => {
    setInviteUserType(code);
    const entry = userTypeMap.get(code);
    if (entry) {
      setInviteRole(entry.defaultRole);
    }
  };
  const roleDisplay = useMemo(() => {
    const map = new Map(roleOptions.map((entry) => [entry.value, entry.label]));
    return (value: string) => map.get(value) ?? value;
  }, [roleOptions]);
  const originDisplay = useMemo(() => {
    const map = new Map<string, string>([
      ['local', messages.admin.retrievalOriginLocal],
      ['file_search', messages.admin.retrievalOriginFile],
    ]);
    return (value: string) => map.get(value) ?? value;
  }, [messages.admin.retrievalOriginFile, messages.admin.retrievalOriginLocal]);
  const saveSsoMutation = useMutation({
    mutationFn: (input: {
      provider: 'saml' | 'oidc';
      label?: string;
      acsUrl?: string;
      entityId?: string;
      defaultRole?: string;
    }) => saveSsoConnection(DEMO_ORG_ID, input),
    onSuccess: () => {
      toast.success(messages.admin.ssoSaved);
      setSsoLabel('');
      setSsoAcsUrl('');
      setSsoEntityId('');
      queryClient.invalidateQueries({ queryKey: ['admin-sso', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.ssoError);
    },
  });
  const deleteSsoMutation = useMutation({
    mutationFn: (connectionId: string) => removeSsoConnection(DEMO_ORG_ID, connectionId),
    onSuccess: () => {
      toast.success(messages.admin.ssoDeleted);
      queryClient.invalidateQueries({ queryKey: ['admin-sso', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.ssoError);
    },
  });
  const createTokenMutation = useMutation({
    mutationFn: (input: { name: string; expiresAt?: string | null }) =>
      createScimAccessToken(DEMO_ORG_ID, input.name, input.expiresAt ?? null),
    onSuccess: (result) => {
      setLastScimToken(result);
      toast.success(messages.admin.scimCreated);
      queryClient.invalidateQueries({ queryKey: ['admin-scim', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.scimError);
    },
  });
  const deleteTokenMutation = useMutation({
    mutationFn: (tokenId: string) => deleteScimAccessToken(DEMO_ORG_ID, tokenId),
    onSuccess: () => {
      toast.success(messages.admin.scimDeleted);
      queryClient.invalidateQueries({ queryKey: ['admin-scim', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.scimError);
    },
  });
  const addIpMutation = useMutation({
    mutationFn: () => upsertIpAllowlistEntry(DEMO_ORG_ID, { cidr: ipCidr, description: ipDescription || null }),
    onSuccess: () => {
      toast.success(messages.admin.ipAdded);
      setIpCidr('');
      setIpDescription('');
      queryClient.invalidateQueries({ queryKey: ['admin-ip', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.ipError);
    },
  });
  const removeIpMutation = useMutation({
    mutationFn: (entryId: string) => deleteIpAllowlistEntry(DEMO_ORG_ID, entryId),
    onSuccess: () => {
      toast.success(messages.admin.ipRemoved);
      queryClient.invalidateQueries({ queryKey: ['admin-ip', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.ipError);
    },
  });
  const ssoConnections = ssoQuery.data?.connections ?? [];
  const scimTokens = (scimQuery.data?.tokens ?? []) as Array<{
    id: string;
    name: string;
    createdAt: string;
    expiresAt?: string | null;
    lastUsedAt?: string | null;
  }>;
  const auditEvents = useMemo(
    () =>
      (auditQuery.data?.events ?? []).map((event: any) => ({
        id: event.id as string,
        kind: event.kind as string,
        object: (event.object as string | null) ?? '—',
        actor: (event.actor_user_id as string | null) ?? messages.admin.auditSystem,
        ts: (event.ts as string | null) ?? (event.created_at as string | null) ?? null,
      })),
    [auditQuery.data, messages.admin.auditSystem],
  );
  const ipEntries = (ipQuery.data?.entries ?? []) as Array<{
    id: string;
    cidr: string;
    description?: string | null;
    created_at?: string | null;
  }>;
  const inviteMutation = useMutation({
    mutationFn: (payload: { email: string; role: string; expiresInHours?: number }) =>
      createOrgInvite(DEMO_ORG_ID, DEMO_USER_ID, payload),
    onSuccess: (data) => {
      toast.success(messages.admin.inviteSuccess);
      setLatestInvite(data);
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-members', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.inviteError);
    },
  });
  const memberRoleMutation = useMutation({
    mutationFn: (payload: { userId: string; role: string }) =>
      updateMemberRole(DEMO_ORG_ID, DEMO_USER_ID, payload.userId, payload.role),
    onSuccess: () => {
      toast.success(messages.admin.roleUpdated);
      queryClient.invalidateQueries({ queryKey: ['admin-members', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.roleUpdateError);
    },
  });
  const jurisdictionMutation = useMutation({
    mutationFn: (payload: { juris_code: string; can_read: boolean; can_write: boolean }) =>
      updateJurisdictions(DEMO_ORG_ID, DEMO_USER_ID, [payload]),
    onSuccess: () => {
      toast.success(messages.admin.jurisdictionUpdated);
      queryClient.invalidateQueries({ queryKey: ['admin-jurisdictions', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.jurisdictionError);
    },
  });

  const handleSsoSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveSsoMutation.mutate({
      provider: ssoProvider,
      label: ssoLabel.trim() || undefined,
      acsUrl: ssoAcsUrl.trim() || undefined,
      entityId: ssoEntityId.trim() || undefined,
      defaultRole: ssoDefaultRole,
    });
  };

  const handleCreateToken = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const expiresAtIso = scimTokenExpires ? new Date(scimTokenExpires).toISOString() : null;
    createTokenMutation.mutate({ name: scimTokenName.trim() || 'Provisioning', expiresAt: expiresAtIso });
  };

  const handleIpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ipCidr.trim()) {
      toast.error(messages.admin.ipCidrRequired);
      return;
    }
    addIpMutation.mutate();
  };
  const handleInviteSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error(messages.admin.inviteEmailRequired);
      return;
    }
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };
  const handleMemberRoleChange = (userId: string, role: string) => {
    memberRoleMutation.mutate({ userId, role });
  };
  const getJurisdictionAccess = (code: string) => {
    return (
      jurisdictionAccess.get(code.toUpperCase()) ?? {
        can_read: false,
        can_write: false,
      }
    );
  };
  const handleJurisdictionToggle = (code: string, field: 'can_read' | 'can_write') => {
    const current = getJurisdictionAccess(code);
    jurisdictionMutation.mutate({
      juris_code: code,
      can_read: field === 'can_read' ? !current.can_read : current.can_read,
      can_write: field === 'can_write' ? !current.can_write : current.can_write,
    });
  };

  const handleCopyToken = async () => {
    if (!lastScimToken?.token) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast.error(messages.admin.scimCopyError);
      return;
    }
    try {
      await navigator.clipboard.writeText(lastScimToken.token);
      toast.success(messages.admin.scimCopySuccess);
    } catch (error) {
      console.error('Failed to copy SCIM token', error);
      toast.error(messages.admin.scimCopyError);
    }
  };

  // Google Drive watch state
  const [driveId, setDriveId] = useState('');
  const [folderId, setFolderId] = useState('');
  const [gdriveState, setGdriveState] = useState<{ expiration?: string | null; drive_id?: string | null; folder_id?: string | null } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const api = await import('../../lib/api');
        const res = await api.fetchGDriveState(DEMO_ORG_ID, DEMO_ORG_ID);
        setGdriveState(res.state);
        if (res.state?.drive_id) setDriveId(res.state.drive_id);
        if (res.state?.folder_id) setFolderId(res.state.folder_id);
      } catch {
        // ignore
      }
    })();
  }, []);
  const installGDrive = async () => {
    try {
      const api = await import('../../lib/api');
      const res = await api.gdriveInstall(DEMO_ORG_ID, DEMO_ORG_ID, driveId || null, folderId || null);
      setGdriveState(res.state);
      toast.success('GDrive installé');
    } catch (e) {
      toast.error('Échec installation GDrive');
    }
  };
  const renewGDrive = async () => {
    try {
      const api = await import('../../lib/api');
      const res = await api.gdriveRenew(DEMO_ORG_ID, DEMO_ORG_ID);
      setGdriveState(res.state);
      toast.success('GDrive renouvelé');
    } catch (e) {
      toast.error('Échec renouvellement GDrive');
    }
  };
  const uninstallGDrive = async () => {
    try {
      const api = await import('../../lib/api');
      await api.gdriveUninstall(DEMO_ORG_ID, DEMO_ORG_ID);
      setGdriveState(null);
      toast.success('GDrive désinstallé');
    } catch (e) {
      toast.error('Échec désinstallation GDrive');
    }
  };
  const processChangesNow = async () => {
    try {
      const api = await import('../../lib/api');
      const res = await api.gdriveProcessChanges(DEMO_ORG_ID, DEMO_ORG_ID, null);
      setGdriveState((s) => ({ ...s, last_page_token: res.next_page_token } as any));
      toast.success(`Traitement: ${res.processed}`);
    } catch (e) {
      toast.error('Échec traitement des changements');
    }
  };
  const backfillNow = async () => {
    try {
      const api = await import('../../lib/api');
      const res = await api.gdriveBackfill(DEMO_ORG_ID, DEMO_ORG_ID, 5);
      setGdriveState((s) => ({ ...s, last_page_token: res.next_page_token } as any));
      toast.success(`Backfill: ${res.processed}`);
    } catch (e) {
      toast.error('Échec backfill');
    }
  };

  const summaryPrimary = useMemo(() => {
    if (!overview) return '—';
    if (overview.documentsTotal === 0) {
      return messages.admin.summaryCoverageEmpty;
    }
    return `${numberFormatter.format(overview.documentsReady)} / ${numberFormatter.format(overview.documentsTotal)}`;
  }, [overview, messages.admin.summaryCoverageEmpty, numberFormatter]);

  const summarySecondary = useMemo(() => {
    if (!overview) return messages.admin.summaryCoverageHint;
    const pending = numberFormatter.format(overview.documentsPending);
    const failed = numberFormatter.format(overview.documentsFailed);
    const skipped = numberFormatter.format(overview.documentsSkipped);
    const chunked = numberFormatter.format(overview.documentsChunked);
    return `${messages.admin.summaryPendingLabel} ${pending} · ${messages.admin.summaryFailedLabel} ${failed} · ${messages.admin.summarySkippedLabel} ${skipped} · ${messages.admin.summaryChunkedLabel} ${chunked}`;
  }, [
    overview,
    messages.admin.summaryCoverageHint,
    messages.admin.summaryPendingLabel,
    messages.admin.summaryFailedLabel,
    messages.admin.summarySkippedLabel,
    messages.admin.summaryChunkedLabel,
    numberFormatter,
  ]);

  const ingestionSummary = useMemo(() => {
    if (!overview) return '—';
    return `${overview.ingestionSuccessLast7Days} ${messages.admin.ingestionSuccessLabel} · ${overview.ingestionFailedLast7Days} ${messages.admin.ingestionFailureLabel}`;
  }, [overview, messages.admin.ingestionSuccessLabel, messages.admin.ingestionFailureLabel]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[2fr_3fr]">
        <div className="space-y-6">
          <Card className="glass-card border border-slate-800/60">
            <CardHeader>
              <CardTitle className="text-slate-100">{messages.admin.metricsTitle}</CardTitle>
              <p className="text-sm text-slate-400">{messages.admin.metricsDescription}</p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <MetricBlock
                label={messages.admin.runs30d}
                primary={overview ? numberFormatter.format(overview.runsLast30Days) : '—'}
                secondary={`${messages.admin.totalRunsLabel} ${overview ? numberFormatter.format(overview.totalRuns) : '—'}`}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.allowlistedPrecision}
                primary={formatPercent(overview?.allowlistedCitationRatio)}
                secondary={`${messages.admin.highRiskRunsLabel} ${overview ? numberFormatter.format(overview.highRiskRuns) : '—'}`}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.hitlPending}
                primary={overview ? numberFormatter.format(overview.hitlPending) : '—'}
                secondary={`${messages.admin.hitlMedianResponse} ${formatMinutes(overview?.hitlMedianResponseMinutes)}`}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.confidentialUsage}
                primary={overview ? numberFormatter.format(overview.confidentialRuns) : '—'}
                secondary={`${messages.admin.avgLatency} ${overview ? decimalFormatter.format(overview.avgLatencyMs) : '—'} ms`}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.summaryCoverage}
                primary={summaryPrimary}
                secondary={summarySecondary}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.ingestionHealth}
                primary={ingestionSummary}
                secondary={messages.admin.ingestionHint}
                loading={metricsQuery.isLoading}
              />
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.peopleTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.peopleDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <form className="grid gap-3 md:grid-cols-[2fr_1.5fr_1fr]" onSubmit={handleInviteSubmit}>
              <Input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="avocat@example.com"
                aria-label={messages.admin.inviteEmailLabel}
              />
              <select
                className={selectClassName}
                value={inviteUserType ?? ''}
                onChange={(event) => handleUserTypeChange(event.target.value)}
                aria-label={messages.admin.inviteUserTypeLabel}
              >
                {inviteUserTypeOptions.length === 0 ? (
                  <option value="">{messages.admin.loading}</option>
                ) : null}
                {inviteUserTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select className={selectClassName} value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}>
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? messages.admin.inviteSending : messages.admin.inviteSend}
              </Button>
            </form>
            {selectedUserType ? (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-3 text-xs text-slate-300">
                <p className="font-semibold text-slate-100">{selectedUserType.label}</p>
                <p className="text-slate-400">
                  {messages.admin.inviteDefaultRole}{' '}
                  <Badge variant="outline">{selectedUserType.defaultRole}</Badge>
                </p>
                {selectedUserType.features.length > 0 ? (
                  <ul className="mt-2 space-y-1 list-disc pl-4">
                    {selectedUserType.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            {latestInvite ? (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                <p className="font-semibold">{messages.admin.inviteLatest}</p>
                <p className="break-all">{latestInvite.token}</p>
                <p className="text-emerald-300/70">{messages.admin.inviteExpires} {formatDateTime(latestInvite.expires_at)}</p>
              </div>
            ) : null}
            {userTypesQuery.isLoading ? (
              <p className="text-xs text-slate-500">{messages.admin.loading}</p>
            ) : userTypesQuery.isError ? (
              <p className="text-xs text-rose-500">{messages.admin.userTypesError}</p>
            ) : userTypes.length > 0 ? (
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 text-xs text-slate-300">
                <p className="font-semibold text-slate-100">{messages.admin.userTypesTitle}</p>
                <p className="text-slate-400">{messages.admin.userTypesDescription}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {userTypes.map((entry) => (
                    <div key={entry.code} className="rounded-xl border border-slate-800/60 bg-slate-900/60 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">{entry.label}</span>
                        <Badge variant="outline">{entry.default_role ?? 'member'}</Badge>
                      </div>
                      {Array.isArray(entry.features) && entry.features.length > 0 ? (
                        <ul className="space-y-1 list-disc pl-4">
                          {entry.features.map((feature) => (
                            <li key={`${entry.code}-${feature}`}>{feature}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-slate-500">{messages.admin.userTypesNoFeatures}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {membersQuery.isLoading ? (
              <p className="text-slate-400">{messages.admin.loading}</p>
            ) : members.length === 0 ? (
              <p className="text-slate-400">{messages.admin.membersEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs uppercase tracking-wide text-slate-400">
                  <thead>
                    <tr>
                      <th className="pb-2 pr-3">{messages.admin.memberName}</th>
                      <th className="pb-2 pr-3">Email</th>
                      <th className="pb-2 pr-3">{messages.admin.memberPhone}</th>
                      <th className="pb-2 pr-3">{messages.admin.memberRole}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {members.map((member) => (
                      <tr key={member.user_id}>
                        <td className="py-2 pr-3">{member.profile?.full_name ?? messages.admin.memberUnknown}</td>
                        <td className="py-2 pr-3 text-slate-400">{member.profile?.email ?? '—'}</td>
                        <td className="py-2 pr-3 text-slate-400">{member.profile?.phone_e164 ?? '—'}</td>
                        <td className="py-2 pr-3">
                          <select
                            className={selectClassName}
                            value={member.role}
                            onChange={(event) => handleMemberRoleChange(member.user_id, event.target.value)}
                            disabled={memberRoleMutation.isPending}
                          >
                            {roleOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.policyTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.policyDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                <div>
                  <p className="font-semibold text-slate-100">{messages.admin.confidentialMode}</p>
                  <p className="text-xs text-slate-400">{messages.admin.confidentialHint}</p>
                </div>
                <Switch checked={confidentialMode} onClick={() => setConfidentialMode((prev) => !prev)} label="" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                <div>
                  <p className="font-semibold text-slate-100">{messages.admin.franceMode}</p>
                  <p className="text-xs text-slate-400">{messages.admin.franceModeHint}</p>
                </div>
                <Switch checked={frMode} onClick={() => setFrMode((prev) => !prev)} label="" />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                <div>
                  <p className="font-semibold text-slate-100">{messages.admin.sensitiveHitl}</p>
                  <p className="text-xs text-slate-400">{messages.admin.sensitiveHitlHint}</p>
                </div>
                <Switch
                  checked={sensitiveTopicHitl}
                  onClick={() => setSensitiveTopicHitl((prev) => !prev)}
                  label=""
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-300">
                <span className="uppercase tracking-wide text-slate-400">{messages.admin.residencyZone}</span>
                <select className={selectClassName} value={residencyZone} onChange={(event) => setResidencyZone(event.target.value)}>
                  <option value="eu">EU</option>
                  <option value="ohada">OHADA</option>
                  <option value="ch">CH</option>
                  <option value="ca">CA</option>
                  <option value="maghreb">Maghreb</option>
                  <option value="rw">RW</option>
                </select>
              </label>
              <div className="flex items-center justify-end">
                <Button type="button" variant="outline" onClick={savePolicies} disabled={policiesQuery.isFetching}>
                  {messages.admin.savePolicies}
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() =>
                window.open('/governance/responsible_ai_policy.md', '_blank', 'noopener,noreferrer')
              }
            >
              {messages.admin.download}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.jurisdictionMatrixTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.jurisdictionMatrixDescription}</p>
          </CardHeader>
          <CardContent className="overflow-x-auto text-sm text-slate-200">
            {jurisdictionsQuery.isLoading ? (
              <p className="text-slate-400">{messages.admin.loading}</p>
            ) : (
              <table className="min-w-full text-left text-xs uppercase tracking-wide text-slate-400">
                <thead>
                  <tr>
                    <th className="pb-2 pr-3">{messages.admin.jurisdictionCode}</th>
                    <th className="pb-2 pr-3 text-right">{messages.admin.jurisdictionRead}</th>
                    <th className="pb-2 pr-3 text-right">{messages.admin.jurisdictionWrite}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {ADMIN_JURISDICTIONS.map((code) => {
                    const access = getJurisdictionAccess(code);
                    return (
                      <tr key={code}>
                        <td className="py-2 pr-3 font-medium text-slate-100">{code}</td>
                        <td className="py-2 pr-3 text-right">
                          <Switch
                            checked={access.can_read}
                            onClick={() => handleJurisdictionToggle(code, 'can_read')}
                            label=""
                          />
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <Switch
                            checked={access.can_write}
                            onClick={() => handleJurisdictionToggle(code, 'can_write')}
                            label=""
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.learningTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.learningDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">{messages.admin.learningAllowlisted}</p>
                <p className="text-2xl font-semibold text-slate-100">
                  {allowlistedMetric ? formatPercent(allowlistedMetric.value) : '—'}
                </p>
                <p className="text-xs text-slate-500">
                  {allowlistedMetric ? formatDateTime(allowlistedMetric.computed_at) : messages.admin.learningNoData}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">{messages.admin.learningDeadLinks}</p>
                <p className="text-2xl font-semibold text-slate-100">
                  {deadLinkMetric ? formatPercent(deadLinkMetric.value) : '—'}
                </p>
                <p className="text-xs text-slate-500">
                  {deadLinkMetric ? formatDateTime(deadLinkMetric.computed_at) : messages.admin.learningNoData}
                </p>
              </div>
            </div>
            {learningSignalsQuery.isLoading ? (
              <p className="text-slate-400">{messages.admin.loadingShort}</p>
            ) : learningSignalsDisplayed.length === 0 ? (
              <p className="text-slate-400">{messages.admin.learningSignalsEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs uppercase tracking-wide text-slate-400">
                  <thead>
                    <tr>
                      <th className="pb-2 pr-3">{messages.admin.learningSignalSource}</th>
                      <th className="pb-2 pr-3">{messages.admin.learningSignalKind}</th>
                      <th className="pb-2 pr-3">{messages.admin.learningSignalRun}</th>
                      <th className="pb-2">{messages.admin.learningSignalWhen}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {learningSignalsDisplayed.map((signal) => (
                      <tr key={signal.id}>
                        <td className="py-2 pr-3 text-slate-300">{signal.source}</td>
                        <td className="py-2 pr-3 text-slate-300">{signal.kind}</td>
                        <td className="py-2 pr-3 text-slate-400">{signal.run_id ?? '—'}</td>
                        <td className="py-2 text-slate-400">{formatDateTime(signal.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        </div>

        <div className="space-y-6">
          <OperationsOverviewCard
            messages={messages}
            data={operationsQuery.data ?? null}
            loading={operationsQuery.isLoading && !operationsQuery.data}
            locale={locale === 'en' ? 'en-US' : 'fr-FR'}
          />

          <JurisdictionCoverageCard
            messages={messages}
            data={jurisdictionCoverage}
            loading={metricsQuery.isLoading && jurisdictionCoverage.length === 0}
          />

          <Card className="glass-card border border-slate-800/60">
            <CardHeader>
              <CardTitle className="text-slate-100">{messages.admin.retrievalTitle}</CardTitle>
              <p className="text-sm text-slate-400">{messages.admin.retrievalDescription}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <MetricBlock
                  label={messages.admin.retrievalRunsLabel}
                  primary={
                    retrievalSummary ? numberFormatter.format(retrievalSummary.runsTotal) : '—'
                  }
                  secondary={`${messages.admin.retrievalLastRun} ${formatDateTime(retrievalSummary?.lastRunAt ?? null)}`}
                  loading={retrievalQuery.isLoading && !retrievalSummary}
                />
                <MetricBlock
                  label={messages.admin.retrievalAllowlistedLabel}
                  primary={formatPercent(retrievalSummary?.allowlistedRatio)}
                  secondary={`${messages.admin.retrievalWarningsLabel} ${
                    retrievalSummary
                      ? numberFormatter.format(retrievalSummary.runsWithTranslationWarnings)
                      : '—'
                  }`}
                  loading={retrievalQuery.isLoading && !retrievalSummary}
                />
                <MetricBlock
                  label={messages.admin.retrievalSnippetMix}
                  primary={`${formatDecimal(retrievalSummary?.avgLocalSnippets)} | ${formatDecimal(
                    retrievalSummary?.avgFileSnippets,
                  )}`}
                  secondary={`${messages.admin.retrievalLocalAverage} ${formatDecimal(
                    retrievalSummary?.avgLocalSnippets,
                  )} · ${messages.admin.retrievalFileAverage} ${formatDecimal(
                    retrievalSummary?.avgFileSnippets,
                  )}`}
                  loading={retrievalQuery.isLoading && !retrievalSummary}
                />
                <MetricBlock
                  label={messages.admin.retrievalNoCitations}
                  primary={
                    retrievalSummary
                      ? numberFormatter.format(retrievalSummary.runsWithoutCitations)
                      : '—'
                  }
                  secondary={messages.admin.retrievalNoCitationsHint}
                  loading={retrievalQuery.isLoading && !retrievalSummary}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-semibold text-slate-100">{messages.admin.retrievalOriginsTitle}</h4>
                  {retrievalQuery.isLoading && retrievalOrigins.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">{messages.admin.loadingShort}</p>
                  ) : retrievalOrigins.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">{messages.admin.retrievalOriginsEmpty}</p>
                  ) : (
                    <table className="mt-3 w-full table-fixed text-sm text-slate-200">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="pb-2">{messages.admin.retrievalOriginLabel}</th>
                          <th className="pb-2 text-right">{messages.admin.retrievalOriginSnippets}</th>
                          <th className="pb-2 text-right">{messages.admin.retrievalAvgSimilarity}</th>
                          <th className="pb-2 text-right">{messages.admin.retrievalAvgWeight}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {retrievalOrigins.map((origin) => (
                          <tr key={origin.origin ?? 'unknown'}>
                            <td className="py-2 pr-2 text-sm text-slate-200">
                              {originDisplay(origin.origin ?? 'unknown')}
                            </td>
                            <td className="py-2 text-right text-sm">
                              {numberFormatter.format(origin.snippetCount)}
                            </td>
                            <td className="py-2 text-right text-sm">
                              {formatPercent(origin.avgSimilarity)}
                            </td>
                            <td className="py-2 text-right text-sm">
                              {formatPercent(origin.avgWeight)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold text-slate-100">{messages.admin.retrievalHostsTitle}</h4>
                  {retrievalQuery.isLoading && retrievalHosts.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">{messages.admin.loadingShort}</p>
                  ) : retrievalHosts.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-400">{messages.admin.retrievalHostsEmpty}</p>
                  ) : (
                    <table className="mt-3 w-full table-fixed text-sm text-slate-200">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="pb-2">{messages.admin.retrievalHost}</th>
                          <th className="pb-2 text-right">{messages.admin.retrievalHostCitations}</th>
                          <th className="pb-2 text-right">{messages.admin.retrievalHostAllowlisted}</th>
                          <th className="pb-2 text-right">{messages.admin.retrievalHostWarnings}</th>
                          <th className="pb-2 text-right">{messages.admin.retrievalHostLastCited}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {retrievalHosts.map((host) => {
                          const allowlistedRatio =
                            host.citationCount === 0
                              ? null
                              : host.allowlistedCount / host.citationCount;
                          return (
                            <tr key={host.host}>
                              <td className="py-2 pr-2 text-sm text-slate-200">{host.host}</td>
                              <td className="py-2 text-right text-sm">
                                {numberFormatter.format(host.citationCount)}
                              </td>
                              <td className="py-2 text-right text-sm">
                                {formatPercent(allowlistedRatio)}
                              </td>
                              <td className="py-2 text-right text-sm">
                                {numberFormatter.format(host.translationWarnings)}
                              </td>
                              <td className="py-2 text-right text-sm">
                                {formatDateTime(host.lastCitedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.evaluationTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.evaluationDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <MetricBlock
                label={messages.admin.evaluationPassRate}
                primary={formatPercent(evaluationSummary?.passRate)}
                secondary={`${messages.admin.evaluationCases} ${
                  evaluationSummary ? numberFormatter.format(evaluationSummary.totalCases) : '—'
                } · ${messages.admin.evaluationsExecuted} ${
                  evaluationSummary ? numberFormatter.format(evaluationSummary.evaluatedResults) : '—'
                } · ${messages.admin.evaluationLastRun} ${formatDateTime(
                  evaluationSummary?.lastResultAt ?? null,
                )}`}
                loading={evaluationQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.evaluationCitationCoverage}
                primary={formatPercent(evaluationSummary?.citationPrecisionCoverage)}
                secondary={`${messages.admin.evaluationCitationP95} ${formatPercent(
                  evaluationSummary?.citationPrecisionP95,
                )}`}
                loading={evaluationQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.evaluationTemporalCoverage}
                primary={formatPercent(evaluationSummary?.temporalValidityCoverage)}
                secondary={`${messages.admin.evaluationTemporalP95} ${formatPercent(
                  evaluationSummary?.temporalValidityP95,
                )}`}
                loading={evaluationQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.evaluationMaghrebCoverage}
                primary={formatPercent(evaluationSummary?.maghrebBannerCoverage)}
                secondary={messages.admin.evaluationMaghrebHint}
                loading={evaluationQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.evaluationRwandaCoverage}
                primary={formatPercent(evaluationSummary?.rwandaNoticeCoverage)}
                secondary={messages.admin.evaluationRwandaHint}
                loading={evaluationQuery.isLoading}
              />
            </div>

            <div>
              <h4 className="font-semibold text-slate-100">{messages.admin.evaluationJurisdictionTitle}</h4>
              {evaluationQuery.isLoading && evaluationJurisdictions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">{messages.admin.loadingShort}</p>
              ) : evaluationJurisdictions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">{messages.admin.evaluationJurisdictionEmpty}</p>
              ) : (
                <table className="mt-3 w-full table-fixed text-sm text-slate-200">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2">{messages.admin.evaluationJurisdiction}</th>
                      <th className="pb-2 text-right">{messages.admin.evaluationCount}</th>
                      <th className="pb-2 text-right">{messages.admin.evaluationPassRate}</th>
                      <th className="pb-2 text-right">{messages.admin.evaluationCitationMedian}</th>
                      <th className="pb-2 text-right">{messages.admin.evaluationTemporalMedian}</th>
                      <th className="pb-2 text-right">{messages.admin.evaluationBindingWarnings}</th>
                      <th className="pb-2 text-right">{messages.admin.evaluationMaghrebCoverage}</th>
                      <th className="pb-2 text-right">{messages.admin.evaluationRwandaCoverage}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {evaluationJurisdictions.map((row) => (
                      <tr key={row.jurisdiction}>
                        <td className="py-2 pr-2 text-sm text-slate-200">{row.label}</td>
                        <td className="py-2 text-right text-sm">{numberFormatter.format(row.evaluationCount)}</td>
                        <td className="py-2 text-right text-sm">{formatPercent(row.passRate)}</td>
                        <td className="py-2 text-right text-sm">{formatPercent(row.citationPrecisionMedian)}</td>
                        <td className="py-2 text-right text-sm">{formatPercent(row.temporalValidityMedian)}</td>
                        <td className="py-2 text-right text-sm">{formatDecimal(row.avgBindingWarnings)}</td>
                        <td className="py-2 text-right text-sm">{formatPercent(row.maghrebBannerCoverage)}</td>
                        <td className="py-2 text-right text-sm">{formatPercent(row.rwandaNoticeCoverage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.identifierTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.identifierDescription}</p>
            </CardHeader>
            <CardContent>
              {metricsQuery.isLoading && identifierRows.length === 0 ? (
                <p className="text-sm text-slate-400">{messages.admin.loading}</p>
              ) : identifierRows.length === 0 ? (
                <p className="text-sm text-slate-400">{messages.admin.identifierEmpty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-200">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2 pr-4">{messages.admin.identifierJurisdiction}</th>
                        <th className="py-2 pr-4 text-right">{messages.admin.identifierSources}</th>
                        <th className="py-2 pr-4 text-right">{messages.admin.identifierEli}</th>
                        <th className="py-2 pr-4 text-right">{messages.admin.identifierEcli}</th>
                        <th className="py-2 pr-4 text-right">{messages.admin.identifierAkoma}</th>
                        <th className="py-2 text-right">{messages.admin.identifierArticles}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {identifierRows.map((row) => {
                        const eliRatio = row.sourcesTotal > 0 ? row.sourcesWithEli / row.sourcesTotal : null;
                        const ecliRatio = row.sourcesTotal > 0 ? row.sourcesWithEcli / row.sourcesTotal : null;
                        const akomaRatio = row.sourcesTotal > 0 ? row.sourcesWithAkoma / row.sourcesTotal : null;
                        return (
                          <tr key={row.jurisdiction}>
                            <td className="py-2 pr-4 font-medium text-slate-100">{row.label}</td>
                            <td className="py-2 pr-4 text-right">{numberFormatter.format(row.sourcesTotal)}</td>
                            <td className="py-2 pr-4 text-right">{formatPercent(eliRatio)}</td>
                            <td className="py-2 pr-4 text-right">{formatPercent(ecliRatio)}</td>
                            <td className="py-2 pr-4 text-right">{formatPercent(akomaRatio)}</td>
                            <td className="py-2 text-right">{numberFormatter.format(row.akomaArticles)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">Retention & Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => exportMutation.mutate('csv')}>Export CSV</Button>
              <Button size="sm" variant="outline" onClick={() => exportMutation.mutate('json')}>Export JSON</Button>
            </div>
            <div className="space-y-2 text-xs">
              {(exportsQuery.data?.exports ?? []).map((ex) => (
                <div key={ex.id} className="flex items-center justify-between gap-3">
                  <span>{ex.format} · {ex.status} · {new Date(ex.created_at).toLocaleString()}</span>
                  {ex.signedUrl ? (
                    <a className="text-teal-200" href={ex.signedUrl} target="_blank" rel="noreferrer">Télécharger</a>
                  ) : null}
                </div>
              ))}
              <p className="text-slate-400">{messages.admin.exportResidencyHint}</p>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <input
                placeholder="Document ID"
                value={deleteDocId}
                onChange={(e) => setDeleteDocId(e.target.value)}
                className={selectClassName}
              />
              <input
                placeholder="Raison (optionnelle)"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className={selectClassName}
              />
              <Button size="sm" variant="outline" onClick={() => deletionMutation.mutate({ id: deleteDocId, reason: deleteReason || undefined })} disabled={!deleteDocId}>
                Supprimer le document
              </Button>
            </div>
            <div className="space-y-2 text-xs">
              {(deletionQuery.data?.requests ?? []).map((req) => (
                <div key={req.id} className="flex items-center justify-between gap-3">
                  <span>{req.target}:{req.target_id ?? 'org'} · {req.status} · {new Date(req.created_at).toLocaleString()}</span>
                  {req.error ? <span className="text-rose-400">{req.error}</span> : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

          <Card className="glass-card border border-slate-800/60">
            <CardHeader>
              <CardTitle className="text-slate-100">Google Drive — Watch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  placeholder="Drive ID (optionnel)"
                  value={driveId}
                  onChange={(e) => setDriveId(e.target.value)}
                  className={selectClassName}
                />
                <input
                  placeholder="Folder ID autorisé"
                  value={folderId}
                  onChange={(e) => setFolderId(e.target.value)}
                  className={selectClassName}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={installGDrive}>
                  Installer
                </Button>
                <Button size="sm" variant="outline" onClick={renewGDrive}>
                  Renouveler
                </Button>
                <Button size="sm" variant="outline" onClick={uninstallGDrive}>
                  Désinstaller
                </Button>
                <Button size="sm" variant="outline" onClick={processChangesNow}>
                  Traiter maintenant
                </Button>
                <Button size="sm" variant="outline" onClick={backfillNow}>
                  Backfill ×5
                </Button>
              </div>
              <div className="text-xs text-slate-400">
                <p>Expiration: {gdriveState?.expiration ?? '—'}</p>
                <p>Dernier token: {(gdriveState as any)?.last_page_token ?? '—'}</p>
              </div>
            </CardContent>
          </Card>
      </div>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.toolPerformance}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.toolHint}</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {metricsQuery.isLoading ? (
              <p className="text-sm text-slate-400">{messages.admin.loading}</p>
            ) : toolRows.length === 0 ? (
              <p className="text-sm text-slate-400">{messages.admin.metricsEmpty}</p>
            ) : (
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">{messages.admin.toolName}</th>
                    <th className="py-2 pr-4">{messages.admin.toolLatency}</th>
                    <th className="py-2 pr-4">{messages.admin.toolLatencyP95}</th>
                    <th className="py-2 pr-4">{messages.admin.toolFailures}</th>
                    <th className="py-2">{messages.admin.lastUpdated}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {toolRows.map((row) => (
                    <tr key={row.toolName}>
                      <td className="py-2 pr-4 font-medium text-slate-100">{row.toolName}</td>
                      <td className="py-2 pr-4">{decimalFormatter.format(row.avgLatencyMs)}</td>
                      <td className="py-2 pr-4">{decimalFormatter.format(row.p95LatencyMs)}</td>
                      <td className="py-2 pr-4">
                        {row.failureCount}/{row.totalInvocations}
                      </td>
                      <td className="py-2 text-slate-400">{row.lastInvokedAt ? formatDateTime(row.lastInvokedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            {alertsQuery.isLoading ? (
              <p className="text-slate-400">Chargement…</p>
            ) : alertsQuery.isError ? (
              <p className="text-rose-400">Erreur</p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span>Citation precision</span>
                  <Badge variant={alertsQuery.data!.results.citationPrecision.ok ? 'success' : 'warning'}>
                    {alertsQuery.data!.results.citationPrecision.value ?? '—'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span>Temporal validity</span>
                  <Badge variant={alertsQuery.data!.results.temporalValidity.ok ? 'success' : 'warning'}>
                    {alertsQuery.data!.results.temporalValidity.value ?? '—'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span>Link health</span>
                  <Badge variant={alertsQuery.data!.results.linkHealth.ok ? 'success' : 'warning'}>
                    {alertsQuery.data!.results.linkHealth.failed}/{alertsQuery.data!.results.linkHealth.totalSources}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.ssoTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.ssoDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={handleSsoSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-300">
                  <span>{messages.admin.ssoProviderLabel}</span>
                  <select
                    className={selectClassName}
                    value={ssoProvider}
                    onChange={(event) => setSsoProvider(event.target.value as 'saml' | 'oidc')}
                  >
                    <option value="saml">{messages.admin.ssoProviderSaml}</option>
                    <option value="oidc">{messages.admin.ssoProviderOidc}</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-300">
                  <span>{messages.admin.ssoDefaultRole}</span>
                  <select
                    className={selectClassName}
                    value={ssoDefaultRole}
                    onChange={(event) => setSsoDefaultRole(event.target.value)}
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="space-y-1 text-sm text-slate-300">
                <span>{messages.admin.ssoLabel}</span>
                <Input value={ssoLabel} onChange={(event) => setSsoLabel(event.target.value)} placeholder="Acme SSO" />
              </label>
              <label className="space-y-1 text-sm text-slate-300">
                <span>{messages.admin.ssoAcsUrl}</span>
                <Input
                  value={ssoAcsUrl}
                  onChange={(event) => setSsoAcsUrl(event.target.value)}
                  placeholder="https://idp.example.com/sso/acs"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-300">
                <span>{messages.admin.ssoEntityId}</span>
                <Input
                  value={ssoEntityId}
                  onChange={(event) => setSsoEntityId(event.target.value)}
                  placeholder="urn:example:idp"
                />
              </label>
              <Button type="submit" className="w-full" disabled={saveSsoMutation.isPending}>
                {messages.admin.ssoSave}
              </Button>
            </form>

            <div className="space-y-2 text-sm text-slate-300">
              <h3 className="text-sm font-semibold text-slate-200">{messages.admin.ssoConnections}</h3>
              {ssoQuery.isLoading ? (
                <p className="text-slate-400">{messages.admin.loadingShort}</p>
              ) : ssoConnections.length === 0 ? (
                <p className="text-slate-400">{messages.admin.ssoNoConnections}</p>
              ) : (
                <ul className="space-y-3">
                  {ssoConnections.map((connection) => (
                    <li
                      key={connection.id}
                      className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-slate-100">
                            {connection.label ?? providerLabels[connection.provider]}
                          </p>
                          <p className="text-xs text-slate-400">
                            {providerLabels[connection.provider]} · {roleDisplay(connection.defaultRole)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDateTime(connection.createdAt)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          className="text-xs text-rose-300 hover:text-rose-100"
                          onClick={() => deleteSsoMutation.mutate(connection.id)}
                          disabled={deleteSsoMutation.isPending}
                        >
                          {messages.admin.delete}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.scimTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.scimDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateToken}>
              <label className="space-y-1 text-sm text-slate-300">
                <span>{messages.admin.scimTokenName}</span>
                <Input
                  value={scimTokenName}
                  onChange={(event) => setScimTokenName(event.target.value)}
                  placeholder="Provisioning"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-300">
                <span>{messages.admin.scimTokenExpiry}</span>
                <Input
                  type="datetime-local"
                  value={scimTokenExpires}
                  onChange={(event) => setScimTokenExpires(event.target.value)}
                />
              </label>
              <div className="md:col-span-2">
                <Button type="submit" className="w-full" disabled={createTokenMutation.isPending}>
                  {messages.admin.scimCreate}
                </Button>
              </div>
            </form>

            {lastScimToken ? (
              <div className="space-y-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
                <p className="text-sm font-semibold text-emerald-200">{messages.admin.scimLastToken}</p>
                <Input readOnly value={lastScimToken.token} className="bg-slate-900/80" />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleCopyToken}>
                    {messages.admin.scimCopy}
                  </Button>
                  <p className="text-xs text-emerald-200/80">
                    {messages.admin.scimTokenValue}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="space-y-2 text-sm text-slate-300">
              <h3 className="text-sm font-semibold text-slate-200">{messages.admin.scimTokens}</h3>
              {scimQuery.isLoading ? (
                <p className="text-slate-400">{messages.admin.loadingShort}</p>
              ) : scimTokens.length === 0 ? (
                <p className="text-slate-400">{messages.admin.scimNoTokens}</p>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className="text-slate-400">
                    <tr>
                      <th className="py-2 pr-3 font-medium">{messages.admin.scimTokenName}</th>
                      <th className="py-2 pr-3 font-medium">{messages.admin.scimCreatedAt}</th>
                      <th className="py-2 pr-3 font-medium">{messages.admin.scimExpiresAt}</th>
                      <th className="py-2 pr-3 font-medium">{messages.admin.scimLastUsedAt}</th>
                      <th className="py-2 font-medium text-right">{messages.admin.delete}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {scimTokens.map((token) => (
                      <tr key={token.id}>
                        <td className="py-2 pr-3 text-slate-200">{token.name}</td>
                        <td className="py-2 pr-3 text-slate-400">{formatDateTime(token.createdAt)}</td>
                        <td className="py-2 pr-3 text-slate-400">
                          {token.expiresAt ? formatDateTime(token.expiresAt) : messages.admin.never}
                        </td>
                        <td className="py-2 pr-3 text-slate-400">
                          {token.lastUsedAt ? formatDateTime(token.lastUsedAt) : messages.admin.never}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            className="text-xs text-rose-300 hover:text-rose-100"
                            onClick={() => deleteTokenMutation.mutate(token.id)}
                            disabled={deleteTokenMutation.isPending}
                          >
                            {messages.admin.delete}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.ipTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.ipDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-3 md:grid-cols-2" onSubmit={handleIpSubmit}>
              <label className="space-y-1 text-sm text-slate-300">
                <span>{messages.admin.ipCidr}</span>
                <Input
                  value={ipCidr}
                  onChange={(event) => setIpCidr(event.target.value)}
                  placeholder="203.0.113.0/24"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-300">
                <span>{messages.admin.ipLabel}</span>
                <Input
                  value={ipDescription}
                  onChange={(event) => setIpDescription(event.target.value)}
                  placeholder="Paris office"
                />
              </label>
              <div className="md:col-span-2">
                <Button type="submit" className="w-full" disabled={addIpMutation.isPending}>
                  {messages.admin.ipAdd}
                </Button>
              </div>
            </form>

            <div className="space-y-2 text-sm text-slate-300">
              <h3 className="text-sm font-semibold text-slate-200">{messages.admin.ipListTitle}</h3>
              {ipQuery.isLoading ? (
                <p className="text-slate-400">{messages.admin.loadingShort}</p>
              ) : ipEntries.length === 0 ? (
                <p className="text-slate-400">{messages.admin.ipEmpty}</p>
              ) : (
                <ul className="space-y-3">
                  {ipEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-start justify-between gap-3 rounded-2xl border border-slate-800/60 bg-slate-950/40 p-3"
                    >
                      <div>
                        <p className="text-slate-100">{entry.cidr}</p>
                        <p className="text-xs text-slate-400">{entry.description ?? '—'}</p>
                        <p className="text-xs text-slate-500">{entry.created_at ? formatDateTime(entry.created_at) : '—'}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-xs text-rose-300 hover:text-rose-100"
                        onClick={() => removeIpMutation.mutate(entry.id)}
                        disabled={removeIpMutation.isPending}
                      >
                        {messages.admin.ipRemove}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.auditTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.auditDescription}</p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {auditQuery.isLoading ? (
              <p className="text-sm text-slate-400">{messages.admin.loadingShort}</p>
            ) : auditEvents.length === 0 ? (
              <p className="text-sm text-slate-400">{messages.admin.auditEmpty}</p>
            ) : (
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">{messages.admin.auditEvent}</th>
                    <th className="py-2 pr-4">{messages.admin.auditObject}</th>
                    <th className="py-2 pr-4">{messages.admin.auditActor}</th>
                    <th className="py-2">{messages.admin.auditDate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {auditEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="py-2 pr-4 font-medium text-slate-100">{event.kind}</td>
                      <td className="py-2 pr-4 text-slate-300">{event.object}</td>
                      <td className="py-2 pr-4 text-slate-400">{event.actor}</td>
                      <td className="py-2 text-slate-400">{formatDateTime(event.ts)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface MetricBlockProps {
  label: string;
  primary: string;
  secondary?: string;
  loading?: boolean;
}

function MetricBlock({ label, primary, secondary, loading }: MetricBlockProps) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-950/40 p-4 shadow-inner">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{loading ? '…' : primary}</p>
      {secondary ? <p className="mt-1 text-xs text-slate-500">{secondary}</p> : null}
    </div>
  );
}

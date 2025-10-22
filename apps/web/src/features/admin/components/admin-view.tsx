'use client';

import type { FormEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { SUPPORTED_JURISDICTIONS } from '@avocat-ai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Input } from '@/ui/input';
import { OperationsOverviewCard } from '@/components/governance/operations-overview-card';
import {
  DEMO_ORG_ID,
  fetchGovernanceMetrics,
  type GovernanceMetricsResponse,
  fetchRetrievalMetrics,
  type RetrievalMetricsResponse,
  fetchEvaluationMetrics,
  type EvaluationMetricsResponse,
  fetchSloMetrics,
  type SloMetricsResponse,
  fetchSsoConnections,
  saveSsoConnection,
  removeSsoConnection,
  fetchScimTokens,
  createScimAccessToken,
  deleteScimAccessToken,
  fetchAuditEvents,
  fetchIpAllowlist,
  upsertIpAllowlistEntry,
  deleteIpAllowlistEntry,
  type ScimTokenResponse,
  getOperationsOverview,
  type OperationsOverviewResponse,
  fetchDeviceSessions,
  revokeDeviceSession,
  type DeviceSession,
} from '@/lib/api';
import type { Messages } from '@/lib/i18n';
import { clientEnv } from '@/env.client';

interface AdminViewProps {
  messages: Messages;
}

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const dateTimeFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value * 100)} %`;
}

function formatMinutes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} min`;
}

function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} s`;
}

function formatPercentValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${decimalFormatter.format(value)} %`;
}

function formatDecimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return decimalFormatter.format(value);
}

const selectClassName =
  'focus-ring w-full rounded-2xl border border-slate-600/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-100';

function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  return dateTimeFormatter.format(date);
}

function useGovernanceMetrics() {
  return useQuery<GovernanceMetricsResponse>({
    queryKey: ['governance-metrics', DEMO_ORG_ID],
    queryFn: () => fetchGovernanceMetrics(DEMO_ORG_ID),
    staleTime: 60_000,
  });
}

export function AdminView({ messages }: AdminViewProps) {
  const queryClient = useQueryClient();
  const metricsQuery = useGovernanceMetrics();
  const overview = metricsQuery.data?.overview ?? null;
  const toolRows = metricsQuery.data?.tools ?? [];
  const jurisdictionLabels = useMemo(() => {
    const arr = SUPPORTED_JURISDICTIONS as Array<{ id: string; labelFr: string }>;
    return new Map(arr.map((entry) => [entry.id, entry.labelFr]));
  }, []);
  const identifierRows = useMemo(() => {
    const rows = metricsQuery.data?.identifiers ?? [];
    type Row = (typeof rows)[number] & { label: string };
    return (rows
      .map((row) => ({
        ...row,
        label: jurisdictionLabels.get(row.jurisdiction) ?? row.jurisdiction,
      })) as Row[]).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [metricsQuery.data, jurisdictionLabels]);
  const jurisdictionCoverage = useMemo(() => {
    const rows = metricsQuery.data?.jurisdictions ?? [];
    type Row = (typeof rows)[number] & { label: string };
    return (rows
      .map((row) => ({
        ...row,
        label: jurisdictionLabels.get(row.jurisdiction) ?? row.jurisdiction,
      })) as Row[]).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [metricsQuery.data, jurisdictionLabels]);
  const retrievalQuery = useQuery<RetrievalMetricsResponse>({
    queryKey: ['retrieval-metrics', DEMO_ORG_ID],
    queryFn: () => fetchRetrievalMetrics(DEMO_ORG_ID),
    staleTime: 60_000,
  });
  const retrievalSummary = retrievalQuery.data?.summary ?? null;
  const retrievalOrigins = useMemo(() => {
    const origins = (retrievalQuery.data?.origins ?? []) as RetrievalMetricsResponse['origins'];
    return origins
      .filter((entry) => entry.snippetCount > 0)
      .sort((a, b) => b.snippetCount - a.snippetCount);
  }, [retrievalQuery.data]);
  const retrievalHosts = useMemo(() => {
    const hosts = (retrievalQuery.data?.hosts ?? []) as RetrievalMetricsResponse['hosts'];
    return hosts
      .filter((entry) => entry.citationCount > 0)
      .sort((a, b) => b.citationCount - a.citationCount)
      .slice(0, 8);
  }, [retrievalQuery.data]);
  const evaluationQuery = useQuery<EvaluationMetricsResponse>({
    queryKey: ['evaluation-metrics', DEMO_ORG_ID],
    queryFn: () => fetchEvaluationMetrics(DEMO_ORG_ID),
    staleTime: 60_000,
  });
  const evaluationSummary = evaluationQuery.data?.summary ?? null;
  const evaluationJurisdictions = useMemo(() => {
    const rows = evaluationQuery.data?.jurisdictions ?? [];
    type Row = (typeof rows)[number] & { label: string };
    return (rows
      .map((row) => ({
        ...row,
        label:
          jurisdictionLabels.get(row.jurisdiction) ??
          (row.jurisdiction === 'UNKNOWN'
            ? messages.admin.evaluationJurisdictionUnknown
            : row.jurisdiction),
      })) as Row[]).sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [evaluationQuery.data, jurisdictionLabels, messages.admin.evaluationJurisdictionUnknown]);
  const sloQuery = useQuery<SloMetricsResponse>({
    queryKey: ['slo-metrics', DEMO_ORG_ID],
    queryFn: () => fetchSloMetrics(DEMO_ORG_ID),
    staleTime: 60_000,
  });
  const sloSummary = sloQuery.data?.summary ?? null;
  const sloSnapshots = sloQuery.data?.snapshots ?? [];
  const operationsQuery = useQuery<OperationsOverviewResponse>({
    queryKey: ['operations-overview', DEMO_ORG_ID],
    queryFn: () => getOperationsOverview(DEMO_ORG_ID),
    staleTime: 60_000,
  });
  const operationsOverview = operationsQuery.data ?? null;
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
    queryFn: () => fetchAuditEvents(DEMO_ORG_ID, 25),
  });
  const ipQuery = useQuery({
    queryKey: ['admin-ip', DEMO_ORG_ID],
    queryFn: () => fetchIpAllowlist(DEMO_ORG_ID),
  });
  const deviceSessionsQuery = useQuery({
    queryKey: ['admin-device-sessions', DEMO_ORG_ID],
    queryFn: () => fetchDeviceSessions(DEMO_ORG_ID, { includeRevoked: false, limit: 200 }),
    staleTime: 30_000,
  });
  const deviceSessions = (deviceSessionsQuery.data?.sessions ?? []) as DeviceSession[];

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
  const providerLabels = useMemo(
    () => ({
      saml: messages.admin.ssoProviderSaml,
      oidc: messages.admin.ssoProviderOidc,
    }),
    [messages.admin.ssoProviderOidc, messages.admin.ssoProviderSaml],
  );
  const typeLabels = useMemo(
    () => ({
      statute: messages.admin.provenanceSourceTypeStatute,
      regulation: messages.admin.provenanceSourceTypeRegulation,
      gazette: messages.admin.provenanceSourceTypeGazette,
      case: messages.admin.provenanceSourceTypeCase,
    }),
    [
      messages.admin.provenanceSourceTypeCase,
      messages.admin.provenanceSourceTypeGazette,
      messages.admin.provenanceSourceTypeRegulation,
      messages.admin.provenanceSourceTypeStatute,
    ],
  );
  const policyDocuments = useMemo(
    () => [
      { href: '@/components/governance/responsible_ai_policy.md', label: messages.admin.policyResponsible },
      { href: '@/components/governance/dpia_commitments.md', label: messages.admin.policyDpia },
      { href: '@/components/governance/coe_ai_alignment.md', label: messages.admin.policyCoe },
      { href: '@/components/governance/cepej_charter_mapping.md', label: messages.admin.policyCepej },
      { href: '@/components/governance/incident_response_plan.md', label: messages.admin.policyIncident },
      { href: '@/components/governance/change_management_playbook.md', label: messages.admin.policyChange },
      { href: '@/components/governance/support_runbook.md', label: messages.admin.policySupport },
      { href: '@/components/governance/slo_and_support.md', label: messages.admin.policySlo },
      { href: '@/components/governance/pilot_onboarding_playbook.md', label: messages.admin.policyOnboarding },
      { href: '@/components/governance/pricing_collateral.md', label: messages.admin.policyPricing },
      { href: '@/components/governance/regulator_outreach_plan.md', label: messages.admin.policyRegulator },
    ],
    [
      messages.admin.policyResponsible,
      messages.admin.policyDpia,
      messages.admin.policyCoe,
      messages.admin.policyCepej,
      messages.admin.policyIncident,
      messages.admin.policyChange,
      messages.admin.policySupport,
      messages.admin.policySlo,
      messages.admin.policyOnboarding,
      messages.admin.policyPricing,
      messages.admin.policyRegulator,
    ],
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

  const bindingSummaryFor = (breakdown: Record<string, number>) => {
    const entries = Object.entries(breakdown ?? {});
    if (entries.length === 0) {
      return messages.admin.provenanceJurisdictionBindingNone;
    }
    return entries
      .map(([language, count]) => `${language.toUpperCase()} (${numberFormatter.format(count)})`)
      .join(', ');
  };

  const languageNoteSummaryFor = (breakdown: Record<string, number>) => {
    const entries = Object.entries(breakdown ?? {});
    if (entries.length === 0) {
      return null;
    }
    return entries
      .map(([note, count]) => `${note} (${numberFormatter.format(count)})`)
      .join(' · ');
  };

  const sourceTypeSummaryFor = (breakdown: Record<string, number>) => {
    const entries = Object.entries(breakdown ?? {});
    if (entries.length === 0) {
      return messages.admin.provenanceJurisdictionBindingNone;
    }
    return entries
      .map(([type, count]) => {
        const label = typeLabels[type as keyof typeof typeLabels] ?? type;
        return `${label} (${numberFormatter.format(count)})`;
      })
      .join(', ');
  };
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
  const revokeDeviceMutation = useMutation({
    mutationFn: (sessionId: string) => revokeDeviceSession(DEMO_ORG_ID, sessionId),
    onSuccess: () => {
      toast.success(messages.admin.devicesRevokeSuccess);
      queryClient.invalidateQueries({ queryKey: ['admin-device-sessions', DEMO_ORG_ID] });
    },
    onError: () => {
      toast.error(messages.admin.devicesRevokeError);
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
  const auditEvents = (auditQuery.data?.events ?? []) as Array<{
    id: string;
    kind: string;
    object: string;
    created_at: string;
    actor_user_id?: string | null;
  }>;
  const ipEntries = (ipQuery.data?.entries ?? []) as Array<{
    id: string;
    cidr: string;
    description?: string | null;
    created_at?: string | null;
  }>;

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

  const summaryPrimary = useMemo(() => {
    if (!overview) return '—';
    if (overview.documentsTotal === 0) {
      return messages.admin.summaryCoverageEmpty;
    }
    return `${numberFormatter.format(overview.documentsReady)} / ${numberFormatter.format(overview.documentsTotal)}`;
  }, [overview, messages.admin.summaryCoverageEmpty]);

  const summarySecondary = useMemo(() => {
    if (!overview) return messages.admin.summaryCoverageHint;
    const pendingNum = overview.documentsPending ?? 0;
    const failedNum = overview.documentsFailed ?? 0;
    const statusKind = failedNum > 0 ? 'error' : pendingNum > 0 ? 'warning' : 'ok';
    const statusLabel =
      statusKind === 'error'
        ? messages.admin.summaryStatusErrors
        : statusKind === 'warning'
          ? messages.admin.summaryStatusPending
          : messages.admin.summaryStatusOk;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge =
      statusKind === 'error'
        ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
        : statusKind === 'warning'
          ? 'bg-amber-900/40 text-amber-200 border-amber-700/50'
          : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';

    const pending = numberFormatter.format(pendingNum);
    const failed = numberFormatter.format(failedNum);
    const skipped = numberFormatter.format(overview.documentsSkipped);
    const chunked = numberFormatter.format(overview.documentsChunked);
    return (
      <span>
        <span className={`${baseBadge} ${colorBadge}`}>{statusLabel}</span>
        <span className="mx-1 text-slate-600">·</span>
        <span>
          {messages.admin.summaryPendingLabel} {pending} · {messages.admin.summaryFailedLabel} {failed} · {messages.admin.summarySkippedLabel} {skipped} · {messages.admin.summaryChunkedLabel} {chunked}
        </span>
      </span>
    );
  }, [
    overview,
    messages.admin.summaryCoverageHint,
    messages.admin.summaryStatusErrors,
    messages.admin.summaryStatusPending,
    messages.admin.summaryStatusOk,
    messages.admin.summaryPendingLabel,
    messages.admin.summaryFailedLabel,
    messages.admin.summarySkippedLabel,
    messages.admin.summaryChunkedLabel,
  ]);

  const ingestionSummary = useMemo(() => {
    if (!overview) return '—';
    return `${overview.ingestionSuccessLast7Days} ${messages.admin.ingestionSuccessLabel} · ${overview.ingestionFailedLast7Days} ${messages.admin.ingestionFailureLabel}`;
  }, [overview, messages.admin.ingestionSuccessLabel, messages.admin.ingestionFailureLabel]);
  const ingestionSecondary = useMemo(() => {
    if (!overview) return messages.admin.ingestionHint;
    const kind = overview.ingestionFailedLast7Days > 0 ? 'error' : 'ok';
    const label = kind === 'error' ? messages.admin.ingestionStatusFailures : messages.admin.ingestionStatusOk;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge =
      kind === 'error'
        ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
        : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';
    return (
      <span>
        <span
          className={`${baseBadge} ${colorBadge}`}
          title={`Success ${overview.ingestionSuccessLast7Days} · Failures ${overview.ingestionFailedLast7Days}`}
        >
          {label}
        </span>
        <span className="mx-1 text-slate-600">·</span>
        <span>{messages.admin.ingestionHint}</span>
      </span>
    );
  }, [overview, messages.admin.ingestionHint, messages.admin.ingestionStatusFailures, messages.admin.ingestionStatusOk]);

  const hitlSecondary = useMemo(() => {
    if (!overview) return `${messages.admin.hitlMedianResponse} ${formatMinutes(null)}`;
    const hasBacklog = (overview.hitlPending ?? 0) > 0;
    const label = hasBacklog ? messages.admin.hitlStatusBacklog : messages.admin.hitlStatusOk;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge = hasBacklog
      ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
      : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';
    return (
      <span>
        <span
          className={`${baseBadge} ${colorBadge}`}
          title={`Pending ${overview.hitlPending} · Median ${formatMinutes(overview.hitlMedianResponseMinutes)}`}
        >
          {label}
        </span>
        <span className="mx-1 text-slate-600">·</span>
        <span>
          {messages.admin.hitlMedianResponse} {formatMinutes(overview.hitlMedianResponseMinutes)}
        </span>
      </span>
    );
  }, [overview, messages.admin.hitlStatusBacklog, messages.admin.hitlStatusOk, messages.admin.hitlMedianResponse]);

  const highRiskSecondary = useMemo(() => {
    const count = overview?.highRiskRuns ?? 0;
    const kind = count > 0 ? 'warning' : 'ok';
    const label = kind === 'ok' ? messages.admin.highRiskStatusOk : messages.admin.highRiskStatusPresent;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge =
      kind === 'ok'
        ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50'
        : 'bg-amber-900/40 text-amber-200 border-amber-700/50';

    // Allowlisted precision badge (green >=95%, amber >=90%, red otherwise)
    const ratio = overview?.allowlistedCitationRatio ?? null;
    let allowlistedKind: 'good' | 'ok' | 'low' | null = null;
    if (typeof ratio === 'number') {
      allowlistedKind = ratio >= 0.95 ? 'good' : ratio >= 0.9 ? 'ok' : 'low';
    }
    const allowlistedLabel =
      allowlistedKind === 'good'
        ? messages.admin.allowlistedStatusGood
        : allowlistedKind === 'ok'
          ? messages.admin.allowlistedStatusAcceptable
          : allowlistedKind === 'low'
            ? messages.admin.allowlistedStatusPoor
            : null;
    const allowlistedColor =
      allowlistedKind === 'good'
        ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50'
        : allowlistedKind === 'ok'
          ? 'bg-amber-900/40 text-amber-200 border-amber-700/50'
          : allowlistedKind === 'low'
            ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
            : null;
    return (
      <span>
        {allowlistedLabel && allowlistedColor ? (
          <>
            <span
              className={`${baseBadge} ${allowlistedColor}`}
              title={`Allowlisted precision ${formatPercent(overview?.allowlistedCitationRatio)} (≥95% good, ≥90% acceptable)`}
            >
              {allowlistedLabel}
            </span>
            <span className="mx-1 text-slate-600">·</span>
          </>
        ) : null}
        <span
          className={`${baseBadge} ${colorBadge}`}
          title={`${messages.admin.highRiskRunsLabel}: ${overview ? numberFormatter.format(count) : '—'}`}
        >
          {label}
        </span>
        <span className="mx-1 text-slate-600">·</span>
        <span>
          {messages.admin.highRiskRunsLabel} {overview ? numberFormatter.format(count) : '—'}
        </span>
      </span>
    );
  }, [overview, messages.admin.allowlistedStatusGood, messages.admin.allowlistedStatusAcceptable, messages.admin.allowlistedStatusPoor, messages.admin.highRiskStatusOk, messages.admin.highRiskStatusPresent, messages.admin.highRiskRunsLabel]);

  const confidentialSecondary = useMemo(() => {
    const count = overview?.confidentialRuns ?? 0;
    const active = count > 0;
    const label = active ? messages.admin.confidentialStatusActive : messages.admin.confidentialStatusNone;
    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge = active
      ? 'bg-sky-900/40 text-sky-200 border-sky-700/50'
      : 'bg-slate-800/40 text-slate-300 border-slate-700/50';
    return (
      <span>
        <span
          className={`${baseBadge} ${colorBadge}`}
          title={`Confidential runs: ${numberFormatter.format(count)}`}
        >
          {label}
        </span>
        <span className="mx-1 text-slate-600">·</span>
        <span>
          {messages.admin.avgLatency} {overview ? decimalFormatter.format(overview.avgLatencyMs) : '—'} ms
        </span>
      </span>
    );
  }, [overview, messages.admin.confidentialStatusActive, messages.admin.confidentialStatusNone, messages.admin.avgLatency]);

  const manifest = metricsQuery.data?.manifest ?? null;
  const manifestStatus = useMemo(() => {
    if (!manifest) return null;
    const s = manifest.status ?? null;
    if (s === 'errors') return messages.admin.manifestStatusErrors;
    if (s === 'warnings') return messages.admin.manifestStatusWarnings;
    if (s === 'ok') return messages.admin.manifestStatusOk;
    if (manifest.errorCount > 0) return messages.admin.manifestStatusErrors;
    if (manifest.warningCount > 0) return messages.admin.manifestStatusWarnings;
    return messages.admin.manifestStatusOk;
  }, [manifest, messages.admin.manifestStatusErrors, messages.admin.manifestStatusWarnings, messages.admin.manifestStatusOk]);
  const manifestPrimary = useMemo(() => {
    if (!manifest) return '—';
    return `${numberFormatter.format(manifest.validCount)} / ${numberFormatter.format(manifest.fileCount)} · ${numberFormatter.format(manifest.warningCount)} ${messages.admin.manifestWarningsLabel} · ${numberFormatter.format(manifest.errorCount)} ${messages.admin.manifestErrorsLabel}`;
  }, [manifest, messages.admin.manifestWarningsLabel, messages.admin.manifestErrorsLabel]);
  const manifestSecondary = useMemo(() => {
    if (!manifest) return messages.admin.manifestHint;
    const name = manifest.manifestName ?? 'manifest.jsonl';
    const statusLabel = manifestStatus ?? '';
    const statusKind = manifest.status === 'errors' ? 'error' : manifest.status === 'warnings' ? 'warning' : 'ok';
    const baseBadge =
      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
    const colorBadge =
      statusKind === 'error'
        ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
        : statusKind === 'warning'
          ? 'bg-amber-900/40 text-amber-200 border-amber-700/50'
          : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';
    const badge = statusLabel ? (
      <span
        className={`${baseBadge} ${colorBadge}`}
        title={`Warnings ${manifest.warningCount} · Errors ${manifest.errorCount}`}
      >
        {statusLabel}
      </span>
    ) : null;
    return (
      <span>
        {badge ? (
          <>
            {badge}
            <span className="mx-1 text-slate-600">·</span>
          </>
        ) : null}
        <span>{name}</span>
        <span className="mx-1 text-slate-600">·</span>
        <span>{formatDateTime(manifest.createdAt)}</span>
      </span>
    );
  }, [manifest, manifestStatus, messages.admin.manifestHint]);

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
                secondary={(function () {
                  const high = clientEnv.NEXT_PUBLIC_DASHBOARD_RUNS_HIGH;
                  const medium = clientEnv.NEXT_PUBLIC_DASHBOARD_RUNS_MEDIUM;
                  const count = overview?.runsLast30Days ?? 0;
                  let kind: 'high' | 'medium' | 'low' = 'low';
                  if (count >= high) kind = 'high';
                  else if (count >= medium) kind = 'medium';
                  const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
                  const { label, color } =
                    kind === 'high'
                      ? { label: messages.admin.runsStatusHigh, color: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50' }
                      : kind === 'medium'
                        ? { label: messages.admin.runsStatusMedium, color: 'bg-amber-900/40 text-amber-200 border-amber-700/50' }
                        : { label: messages.admin.runsStatusLow, color: 'bg-slate-800/40 text-slate-300 border-slate-700/50' };
                  return (
                    <span>
                      <span
                        className={`${baseBadge} ${color}`}
                        title={`Runs(30d): ${numberFormatter.format(count)} (high ≥ ${high}, medium ≥ ${medium})`}
                      >
                        {label}
                      </span>
                      <span className="mx-1 text-slate-600">·</span>
                      <span>
                        {messages.admin.totalRunsLabel} {overview ? numberFormatter.format(overview.totalRuns) : '—'}
                      </span>
                    </span>
                  );
                })()}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.allowlistedPrecision}
                primary={formatPercent(overview?.allowlistedCitationRatio)}
                secondary={highRiskSecondary}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.hitlPending}
                primary={overview ? numberFormatter.format(overview.hitlPending) : '—'}
                secondary={hitlSecondary}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.confidentialUsage}
                primary={overview ? numberFormatter.format(overview.confidentialRuns) : '—'}
                secondary={confidentialSecondary}
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
                secondary={ingestionSecondary}
                loading={metricsQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.manifestStatus}
                primary={manifestPrimary}
                secondary={manifestSecondary}
                loading={metricsQuery.isLoading}
              />
            </CardContent>
          </Card>

          <OperationsOverviewCard
            messages={messages}
            data={operationsOverview}
            loading={operationsQuery.isLoading && !operationsOverview}
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
                  secondary={(function () {
                    const count = retrievalSummary?.runsWithoutCitations ?? null;
                    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
                    const isOk = count !== null && count === 0;
                    const label = isOk
                      ? messages.admin.retrievalStatusOk
                      : messages.admin.retrievalStatusAttention;
                    const color = isOk
                      ? 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50'
                      : 'bg-rose-900/40 text-rose-200 border-rose-700/50';
                    return (
                      <span>
                        <span
                          className={`${baseBadge} ${color}`}
                          title={`Runs without citations: ${count ?? '—'}`}
                        >
                          {label}
                        </span>
                        <span className="mx-1 text-slate-600">·</span>
                        <span>{messages.admin.retrievalNoCitationsHint}</span>
                      </span>
                    );
                  })()}
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
            <CardTitle className="text-slate-100">{messages.admin.sloTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.sloDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <MetricBlock
                label={messages.admin.sloUptime}
                primary={formatPercentValue(sloSummary?.apiUptimeP95)}
                secondary={messages.admin.sloLastCapture.replace(
                  '{date}',
                  formatDateTime(sloSummary?.latestCapture ?? null),
                )}
                loading={sloQuery.isLoading && !sloSummary}
              />
              <MetricBlock
                label={messages.admin.sloHitlP95}
                primary={formatMinutes(
                  sloSummary?.hitlResponseP95Seconds === null
                    ? null
                    : (sloSummary?.hitlResponseP95Seconds ?? 0) / 60,
                )}
                secondary={messages.admin.sloHitlHint}
                loading={sloQuery.isLoading && !sloSummary}
              />
              <MetricBlock
                label={messages.admin.sloRetrievalP95}
                primary={formatSeconds(sloSummary?.retrievalLatencyP95Seconds)}
                secondary={messages.admin.sloRetrievalHint}
                loading={sloQuery.isLoading && !sloSummary}
              />
              <MetricBlock
                label={messages.admin.sloCitationP95}
                primary={formatPercent(sloSummary?.citationPrecisionP95)}
                secondary={messages.admin.sloCitationHint}
                loading={sloQuery.isLoading && !sloSummary}
              />
            </div>

            <div>
              <h4 className="font-semibold text-slate-100">{messages.admin.sloSnapshotsTitle}</h4>
              {sloQuery.isLoading && sloSnapshots.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">{messages.admin.loadingShort}</p>
              ) : sloSnapshots.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">{messages.admin.sloSnapshotsEmpty}</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-slate-200">
                    <thead className="text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="py-2 pr-4">{messages.admin.sloCapturedAt}</th>
                        <th className="py-2 pr-4">{messages.admin.sloUptime}</th>
                        <th className="py-2 pr-4">{messages.admin.sloHitlP95}</th>
                        <th className="py-2 pr-4">{messages.admin.sloRetrievalP95}</th>
                        <th className="py-2 pr-4">{messages.admin.sloCitationP95}</th>
                        <th className="py-2">{messages.admin.sloNotes}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {sloSnapshots.slice(0, 5).map((snapshot) => (
                        <tr key={snapshot.captured_at}>
                          <td className="py-2 pr-4 text-slate-300">{formatDateTime(snapshot.captured_at)}</td>
                          <td className="py-2 pr-4">{formatPercentValue(snapshot.api_uptime_percent)}</td>
                          <td className="py-2 pr-4">{formatMinutes(
                            snapshot.hitl_response_p95_seconds === null
                              ? null
                              : snapshot.hitl_response_p95_seconds / 60,
                          )}</td>
                          <td className="py-2 pr-4">{formatSeconds(snapshot.retrieval_latency_p95_seconds)}</td>
                          <td className="py-2 pr-4">{formatPercent(snapshot.citation_precision_p95)}</td>
                          <td className="py-2 text-slate-300">{snapshot.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border border-slate-800/60">
          <CardHeader>
            <CardTitle className="text-slate-100">{messages.admin.provenanceJurisdictionTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.provenanceJurisdictionDescription}</p>
          </CardHeader>
          <CardContent>
            {metricsQuery.isLoading && jurisdictionCoverage.length === 0 ? (
              <p className="text-sm text-slate-400">{messages.admin.loadingShort}</p>
            ) : jurisdictionCoverage.length === 0 ? (
              <p className="text-sm text-slate-400">{messages.admin.provenanceJurisdictionEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-sm text-slate-200">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2">{messages.admin.provenanceJurisdictionColumnJurisdiction}</th>
                      <th className="pb-2 text-right">{messages.admin.provenanceJurisdictionColumnResidency}</th>
                      <th className="pb-2 text-right">{messages.admin.provenanceJurisdictionColumnSources}</th>
                      <th className="pb-2">{messages.admin.provenanceJurisdictionColumnBinding}</th>
                      <th className="pb-2">{messages.admin.provenanceJurisdictionColumnIdentifiers}</th>
                      <th className="pb-2">{messages.admin.provenanceJurisdictionColumnAkoma}</th>
                      <th className="pb-2">{messages.admin.provenanceJurisdictionColumnTypes}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {jurisdictionCoverage.map((row) => {
                      const bindingSummary = bindingSummaryFor(row.bindingBreakdown ?? {});
                      const languageNotes = languageNoteSummaryFor(row.languageNoteBreakdown ?? {});
                      const identifiersText = messages.admin.provenanceJurisdictionIdentifiers
                        .replace('{eli}', numberFormatter.format(row.sourcesWithEli ?? 0))
                        .replace('{ecli}', numberFormatter.format(row.sourcesWithEcli ?? 0));
                      const akomaText = messages.admin.provenanceJurisdictionAkoma.replace(
                        '{count}',
                        numberFormatter.format(row.sourcesWithAkoma ?? 0),
                      );
                      const typeSummary = sourceTypeSummaryFor(row.sourceTypeBreakdown ?? {});
                      return (
                        <tr key={row.jurisdiction}>
                          <td className="py-3 pr-3 align-top">
                            <div className="font-medium text-slate-100">{row.label}</div>
                          </td>
                          <td className="py-3 pr-3 text-right align-top text-sm text-slate-300">
                            {row.residencyZone.toUpperCase()}
                          </td>
                          <td className="py-3 pr-3 text-right align-top text-sm text-slate-300">
                            {`${numberFormatter.format(row.sourcesConsolidated ?? 0)} / ${numberFormatter.format(
                              row.totalSources ?? 0,
                            )}`}
                          </td>
                          <td className="py-3 pr-3 align-top text-sm text-slate-200">
                            {bindingSummary}
                            {languageNotes ? (
                              <div className="text-xs text-slate-400">{languageNotes}</div>
                            ) : null}
                          </td>
                          <td className="py-3 pr-3 align-top text-sm text-slate-200">{identifiersText}</td>
                          <td className="py-3 pr-3 align-top text-sm text-slate-200">{akomaText}</td>
                          <td className="py-3 align-top text-sm text-slate-200">{typeSummary}</td>
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
            <CardTitle className="text-slate-100">{messages.admin.evaluationTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.evaluationDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <MetricBlock
                label={messages.admin.evaluationPassRate}
                primary={formatPercent(evaluationSummary?.passRate)}
                secondary={(function () {
                  const pass = evaluationSummary?.passRate ?? null;
                  const good = clientEnv.NEXT_PUBLIC_EVAL_PASS_GOOD;
                  const ok = clientEnv.NEXT_PUBLIC_EVAL_PASS_OK;
                  let kind: 'good' | 'ok' | 'poor' | null = null;
                  if (typeof pass === 'number') {
                    kind = pass >= good ? 'good' : pass >= ok ? 'ok' : 'poor';
                  }
                  const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
                  const { label, color } =
                    kind === 'good'
                      ? { label: messages.admin.evaluationStatusGood, color: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50' }
                      : kind === 'ok'
                        ? { label: messages.admin.evaluationStatusAcceptable, color: 'bg-amber-900/40 text-amber-200 border-amber-700/50' }
                        : kind === 'poor'
                          ? { label: messages.admin.evaluationStatusPoor, color: 'bg-rose-900/40 text-rose-200 border-rose-700/50' }
                          : { label: null, color: '' } as any;
                  return (
                    <span>
                      {label ? (
                        <>
                          <span
                            className={`${baseBadge} ${color}`}
                            title={`Pass rate ${formatPercent(evaluationSummary?.passRate)} (good ≥ ${clientEnv.NEXT_PUBLIC_EVAL_PASS_GOOD * 100}%, ok ≥ ${clientEnv.NEXT_PUBLIC_EVAL_PASS_OK * 100}%)`}
                          >
                            {label}
                          </span>
                          <span className="mx-1 text-slate-600">·</span>
                        </>
                      ) : null}
                      <span>
                        {messages.admin.evaluationCases} {evaluationSummary ? numberFormatter.format(evaluationSummary.totalCases) : '—'} · {messages.admin.evaluationsExecuted} {evaluationSummary ? numberFormatter.format(evaluationSummary.evaluatedResults) : '—'} · {messages.admin.evaluationLastRun} {formatDateTime(evaluationSummary?.lastResultAt ?? null)}
                      </span>
                    </span>
                  );
                })()}
                loading={evaluationQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.evaluationCitationCoverage}
                primary={formatPercent(evaluationSummary?.citationPrecisionCoverage)}
                secondary={(function () {
                  const cov = evaluationSummary?.citationPrecisionCoverage ?? null;
                  const good = clientEnv.NEXT_PUBLIC_EVAL_COVERAGE_GOOD;
                  const ok = clientEnv.NEXT_PUBLIC_EVAL_COVERAGE_OK;
                  let kind: 'good' | 'ok' | 'poor' | null = null;
                  if (typeof cov === 'number') {
                    kind = cov >= good ? 'good' : cov >= ok ? 'ok' : 'poor';
                  }
                  const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
                  const { label, color } =
                    kind === 'good'
                      ? { label: messages.admin.evaluationStatusGood, color: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50' }
                      : kind === 'ok'
                        ? { label: messages.admin.evaluationStatusAcceptable, color: 'bg-amber-900/40 text-amber-200 border-amber-700/50' }
                        : kind === 'poor'
                          ? { label: messages.admin.evaluationStatusPoor, color: 'bg-rose-900/40 text-rose-200 border-rose-700/50' }
                          : { label: null, color: '' } as any;
                  return (
                    <span>
                      {label ? (
                        <>
                          <span
                            className={`${baseBadge} ${color}`}
                            title={`Coverage ${formatPercent(evaluationSummary?.citationPrecisionCoverage)} (good ≥ ${clientEnv.NEXT_PUBLIC_EVAL_COVERAGE_GOOD * 100}%, ok ≥ ${clientEnv.NEXT_PUBLIC_EVAL_COVERAGE_OK * 100}%)`}
                          >
                            {label}
                          </span>
                          <span className="mx-1 text-slate-600">·</span>
                        </>
                      ) : null}
                      <span>
                        {messages.admin.evaluationCitationP95} {formatPercent(evaluationSummary?.citationPrecisionP95)}
                      </span>
                    </span>
                  );
                })()}
                loading={evaluationQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.evaluationTemporalCoverage}
                primary={formatPercent(evaluationSummary?.temporalValidityCoverage)}
                secondary={(function () {
                  const cov = evaluationSummary?.temporalValidityCoverage ?? null;
                  const good = clientEnv.NEXT_PUBLIC_EVAL_COVERAGE_GOOD;
                  const ok = clientEnv.NEXT_PUBLIC_EVAL_COVERAGE_OK;
                  let kind: 'good' | 'ok' | 'poor' | null = null;
                  if (typeof cov === 'number') {
                    kind = cov >= good ? 'good' : cov >= ok ? 'ok' : 'poor';
                  }
                  const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
                  const { label, color } =
                    kind === 'good'
                      ? { label: messages.admin.evaluationStatusGood, color: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50' }
                      : kind === 'ok'
                        ? { label: messages.admin.evaluationStatusAcceptable, color: 'bg-amber-900/40 text-amber-200 border-amber-700/50' }
                        : kind === 'poor'
                          ? { label: messages.admin.evaluationStatusPoor, color: 'bg-rose-900/40 text-rose-200 border-rose-700/50' }
                          : { label: null, color: '' } as any;
                  return (
                    <span>
                      {label ? (
                        <>
                          <span
                            className={`${baseBadge} ${color}`}
                            title={`Coverage ${formatPercent(evaluationSummary?.temporalValidityCoverage)} (good ≥ ${clientEnv.NEXT_PUBLIC_EVAL_COVERAGE_GOOD * 100}%, ok ≥ ${clientEnv.NEXT_PUBLIC_EVAL_COVERAGE_OK * 100}%)`}
                          >
                            {label}
                          </span>
                          <span className="mx-1 text-slate-600">·</span>
                        </>
                      ) : null}
                      <span>
                        {messages.admin.evaluationTemporalP95} {formatPercent(evaluationSummary?.temporalValidityP95)}
                      </span>
                    </span>
                  );
                })()}
                loading={evaluationQuery.isLoading}
              />
              <MetricBlock
                label={messages.admin.evaluationMaghrebCoverage}
                primary={formatPercent(evaluationSummary?.maghrebBannerCoverage)}
                secondary={(function () {
                  const cov = evaluationSummary?.maghrebBannerCoverage ?? null;
                  const good = clientEnv.NEXT_PUBLIC_EVAL_MAGHREB_GOOD;
                  const ok = clientEnv.NEXT_PUBLIC_EVAL_MAGHREB_OK;
                  let kind: 'good' | 'ok' | 'poor' | null = null;
                  if (typeof cov === 'number') {
                    kind = cov >= good ? 'good' : cov >= ok ? 'ok' : 'poor';
                  }
                  const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
                  const { label, color } =
                    kind === 'good'
                      ? { label: messages.admin.evaluationStatusGood, color: 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50' }
                      : kind === 'ok'
                        ? { label: messages.admin.evaluationStatusAcceptable, color: 'bg-amber-900/40 text-amber-200 border-amber-700/50' }
                        : kind === 'poor'
                          ? { label: messages.admin.evaluationStatusPoor, color: 'bg-rose-900/40 text-rose-200 border-rose-700/50' }
                          : { label: null, color: '' } as any;
                  return (
                    <span>
                      {label ? (
                        <>
                          <span
                            className={`${baseBadge} ${color}`}
                            title={`Coverage ${formatPercent(evaluationSummary?.maghrebBannerCoverage)} (good ≥ ${clientEnv.NEXT_PUBLIC_EVAL_MAGHREB_GOOD * 100}%, ok ≥ ${clientEnv.NEXT_PUBLIC_EVAL_MAGHREB_OK * 100}%)`}
                          >
                            {label}
                          </span>
                          <span className="mx-1 text-slate-600">·</span>
                        </>
                      ) : null}
                      <span>{messages.admin.evaluationMaghrebHint}</span>
                    </span>
                  );
                })()}
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
              <CardTitle className="text-slate-100">{messages.admin.policies}</CardTitle>
              <p className="text-sm text-slate-400">{messages.admin.policyDescription}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {policyDocuments.map((doc) => (
                  <Button key={doc.href} asChild variant="outline">
                    <a href={doc.href} target="_blank" rel="noreferrer">
                      {doc.label}
                    </a>
                  </Button>
                ))}
              </div>
              <p className="text-sm text-slate-400">{messages.admin.policyEvidenceHint}</p>
              <ul className="space-y-2 text-sm text-slate-200">
                <li>{messages.admin.policyRetention}</li>
                <li>{messages.admin.policyIncidentHint}</li>
                <li>{messages.admin.policyChangeHint}</li>
                <li>{messages.admin.policySupportHint}</li>
                <li>{messages.admin.policyGoNoGo}</li>
              </ul>
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
                  {toolRows.map((row) => {
                    const warn = clientEnv.NEXT_PUBLIC_TOOL_FAILURE_WARN;
                    const crit = clientEnv.NEXT_PUBLIC_TOOL_FAILURE_CRIT;
                    const ratio = row.totalInvocations > 0 ? row.failureCount / row.totalInvocations : 0;
                    const kind = ratio >= crit ? 'crit' : ratio >= warn ? 'warn' : 'ok';
                    const baseBadge = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium';
                    const label =
                      kind === 'crit'
                        ? messages.admin.toolHealthCrit
                        : kind === 'warn'
                          ? messages.admin.toolHealthWarn
                          : messages.admin.toolHealthGood;
                    const color =
                      kind === 'crit'
                        ? 'bg-rose-900/40 text-rose-200 border-rose-700/50'
                        : kind === 'warn'
                          ? 'bg-amber-900/40 text-amber-200 border-amber-700/50'
                          : 'bg-emerald-900/40 text-emerald-200 border-emerald-700/50';
                    return (
                      <tr key={row.toolName}>
                        <td className="py-2 pr-4 font-medium text-slate-100">{row.toolName}</td>
                        <td className="py-2 pr-4">{decimalFormatter.format(row.avgLatencyMs)}</td>
                        <td className="py-2 pr-4">{decimalFormatter.format(row.p95LatencyMs)}</td>
                        <td className="py-2 pr-4">
                          <span
                            className={`${baseBadge} ${color}`}
                            title={`Failure rate ${(ratio * 100).toFixed(1)}% (warn ≥ ${(warn * 100).toFixed(0)}%, crit ≥ ${(crit * 100).toFixed(0)}%)`}
                          >
                            {label}
                          </span>
                          <span className="mx-1 text-slate-600">·</span>
                          <span>
                            {row.failureCount}/{row.totalInvocations}
                          </span>
                        </td>
                        <td className="py-2 text-slate-400">{row.lastInvokedAt ? formatDateTime(row.lastInvokedAt) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
            <CardTitle className="text-slate-100">{messages.admin.devicesTitle}</CardTitle>
            <p className="text-sm text-slate-400">{messages.admin.devicesDescription}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            {deviceSessionsQuery.isLoading ? (
              <p className="text-slate-400">{messages.admin.loadingShort}</p>
            ) : deviceSessions.length === 0 ? (
              <p className="text-slate-400">{messages.admin.devicesEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm text-slate-200">
                  <thead className="text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="py-2 pr-4">{messages.admin.devicesTableDevice}</th>
                      <th className="py-2 pr-4">{messages.admin.devicesTablePlatform}</th>
                      <th className="py-2 pr-4">{messages.admin.devicesTableIp}</th>
                      <th className="py-2 pr-4">{messages.admin.devicesTableAuth}</th>
                      <th className="py-2 pr-4">{messages.admin.devicesTableLastSeen}</th>
                      <th className="py-2 pr-4">{messages.admin.devicesTableStatus}</th>
                      <th className="py-2">{messages.admin.devicesTableActions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {deviceSessions.map((session) => {
                      const statusActive = !session.revokedAt;
                      return (
                        <tr key={session.id}>
                          <td className="py-3 pr-4 align-top">
                            <p className="font-semibold text-slate-100">{session.deviceLabel ?? messages.admin.devicesUnknownDevice}</p>
                            <p className="text-xs text-slate-400 break-all">{session.userAgent ?? messages.admin.devicesUnknownAgent}</p>
                            <p className="text-xs text-slate-500">{messages.admin.devicesFingerprint}: {session.deviceFingerprint.slice(0, 12)}…</p>
                          </td>
                          <td className="py-3 pr-4 align-top text-slate-300">
                            <div className="space-y-1">
                              <div>{session.platform ?? '—'}</div>
                              <div className="text-xs text-slate-500">{session.clientVersion ?? '—'}</div>
                              {session.attested ? (
                                <span className="inline-flex items-center rounded-full border border-emerald-400/50 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200">
                                  {messages.admin.devicesAttested}
                                </span>
                              ) : null}
                              {session.passkey ? (
                                <span className="ml-1 inline-flex items-center rounded-full border border-sky-400/50 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                                  {messages.admin.devicesPasskey}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <p>{session.ipAddress ?? '—'}</p>
                            <p className="text-xs text-slate-500">
                              {session.metadata?.role
                                ? roleDisplay(String(session.metadata.role))
                                : '—'}
                            </p>
                          </td>
                          <td className="py-3 pr-4 align-top text-slate-300">
                            <p>{session.authStrength ?? '—'}</p>
                            <p className="text-xs text-slate-500">
                              {session.mfaMethod ? `${messages.admin.devicesMfa}: ${session.mfaMethod}` : '—'}
                            </p>
                          </td>
                          <td className="py-3 pr-4 align-top text-slate-300">
                            <p>{formatDateTime(session.lastSeenAt)}</p>
                            <p className="text-xs text-slate-500">{messages.admin.devicesCreated}: {formatDateTime(session.createdAt)}</p>
                          </td>
                          <td className="py-3 pr-4 align-top">
                            <span
                              className={statusActive ? 'text-emerald-200' : 'text-rose-300'}
                            >
                              {statusActive ? messages.admin.devicesStatusActive : messages.admin.devicesStatusRevoked}
                            </span>
                            {!statusActive && session.revokedAt ? (
                              <p className="text-xs text-slate-500">{formatDateTime(session.revokedAt)}</p>
                            ) : null}
                          </td>
                          <td className="py-3 align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              className="text-xs text-rose-300 hover:text-rose-100"
                              disabled={!statusActive || revokeDeviceMutation.isPending}
                              onClick={() => revokeDeviceMutation.mutate(session.id)}
                            >
                              {messages.admin.devicesRevoke}
                            </Button>
                          </td>
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
                      <td className="py-2 pr-4 text-slate-400">
                        {event.actor_user_id ?? messages.admin.auditSystem}
                      </td>
                      <td className="py-2 text-slate-400">{formatDateTime(event.created_at)}</td>
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
  secondary?: ReactNode;
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

'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { SUPPORTED_JURISDICTIONS } from '@avocat-ai/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { OperationsOverviewCard } from '../governance/operations-overview-card';
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
} from '../../lib/api';
import type { Messages } from '../../lib/i18n';

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
  const jurisdictionLabels = useMemo(
    () => new Map(SUPPORTED_JURISDICTIONS.map((entry) => [entry.id, entry.labelFr])),
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
  const jurisdictionCoverage = useMemo(() => {
    const rows = metricsQuery.data?.jurisdictions ?? [];
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
      { href: '/governance/responsible_ai_policy.md', label: messages.admin.policyResponsible },
      { href: '/governance/dpia_commitments.md', label: messages.admin.policyDpia },
      { href: '/governance/coe_ai_alignment.md', label: messages.admin.policyCoe },
      { href: '/governance/cepej_charter_mapping.md', label: messages.admin.policyCepej },
      { href: '/governance/incident_response_plan.md', label: messages.admin.policyIncident },
      { href: '/governance/change_management_playbook.md', label: messages.admin.policyChange },
      { href: '/governance/support_runbook.md', label: messages.admin.policySupport },
      { href: '/governance/slo_and_support.md', label: messages.admin.policySlo },
      { href: '/governance/pilot_onboarding_playbook.md', label: messages.admin.policyOnboarding },
      { href: '/governance/pricing_collateral.md', label: messages.admin.policyPricing },
      { href: '/governance/regulator_outreach_plan.md', label: messages.admin.policyRegulator },
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

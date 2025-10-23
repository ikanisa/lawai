import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Messages } from '@/lib/i18n';

const {
  fetchGovernanceMetricsMock,
  fetchRetrievalMetricsMock,
  fetchEvaluationMetricsMock,
  fetchSloMetricsMock,
  fetchSsoConnectionsMock,
  fetchScimTokensMock,
  fetchAuditEventsMock,
  fetchIpAllowlistMock,
  fetchOperationsOverviewMock,
} = vi.hoisted(() => {
  return {
    fetchGovernanceMetricsMock: vi.fn(),
    fetchRetrievalMetricsMock: vi.fn(),
    fetchEvaluationMetricsMock: vi.fn(),
    fetchSloMetricsMock: vi.fn(),
    fetchSsoConnectionsMock: vi.fn(),
    fetchScimTokensMock: vi.fn(),
    fetchAuditEventsMock: vi.fn(),
    fetchIpAllowlistMock: vi.fn(),
    fetchOperationsOverviewMock: vi.fn(),
  };
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesFr = JSON.parse(
  readFileSync(join(__dirname, '../messages/fr.json'), 'utf-8'),
) as Messages;

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type ApiModule = typeof import('../src/lib/api');

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<ApiModule>('../src/lib/api');
  return {
    ...actual,
    fetchGovernanceMetrics: fetchGovernanceMetricsMock,
    fetchRetrievalMetrics: fetchRetrievalMetricsMock,
    fetchEvaluationMetrics: fetchEvaluationMetricsMock,
    fetchSloMetrics: fetchSloMetricsMock,
    fetchSsoConnections: fetchSsoConnectionsMock,
    fetchScimTokens: fetchScimTokensMock,
    fetchAuditEvents: fetchAuditEventsMock,
    fetchIpAllowlist: fetchIpAllowlistMock,
    getOperationsOverview: fetchOperationsOverviewMock,
  } satisfies ApiModule;
});

const { AdminView } = await import('@/features/admin/components/admin-view');

describe('AdminView provenance dashboard', () => {
  beforeEach(() => {
    fetchGovernanceMetricsMock.mockReset();
    fetchRetrievalMetricsMock.mockReset();
    fetchEvaluationMetricsMock.mockReset();
    fetchSloMetricsMock.mockReset();
    fetchSsoConnectionsMock.mockReset();
    fetchScimTokensMock.mockReset();
    fetchAuditEventsMock.mockReset();
    fetchIpAllowlistMock.mockReset();
    fetchOperationsOverviewMock.mockReset();
  });

  it('renders residency and identifier coverage per jurisdiction', async () => {
    fetchGovernanceMetricsMock.mockResolvedValue({
      overview: null,
      tools: [],
      identifiers: [],
      jurisdictions: [
        {
          jurisdiction: 'FR',
          label: 'France',
          residencyZone: 'eu',
          totalSources: 4,
          sourcesConsolidated: 4,
          sourcesWithBinding: 4,
          sourcesWithLanguageNote: 2,
          sourcesWithEli: 4,
          sourcesWithEcli: 1,
          sourcesWithAkoma: 3,
          bindingBreakdown: { fr: 4 },
          sourceTypeBreakdown: { statute: 3, case: 1 },
          languageNoteBreakdown: { 'version consolidée': 2 },
        },
      ],
    });
    fetchRetrievalMetricsMock.mockResolvedValue({
      summary: null,
      origins: [],
      hosts: [],
    });
    fetchEvaluationMetricsMock.mockResolvedValue({ summary: null, jurisdictions: [] });
    fetchSloMetricsMock.mockResolvedValue({
      summary: {
        snapshots: 1,
        latestCapture: '2024-05-01T10:00:00Z',
        apiUptimeP95: 99.9,
        hitlResponseP95Seconds: 600,
        retrievalLatencyP95Seconds: 8,
        citationPrecisionP95: 0.98,
      },
      snapshots: [
        {
          captured_at: '2024-05-01T10:00:00Z',
          api_uptime_percent: 99.9,
          hitl_response_p95_seconds: 600,
          retrieval_latency_p95_seconds: 8,
          citation_precision_p95: 0.98,
          notes: 'OK',
        },
      ],
    });
    fetchOperationsOverviewMock.mockResolvedValue({
      slo: {
        summary: {
          snapshots: 1,
          latestCapture: '2024-05-01T10:00:00Z',
          apiUptimeP95: 99.9,
          hitlResponseP95Seconds: 600,
          retrievalLatencyP95Seconds: 8,
          citationPrecisionP95: 0.98,
        },
        snapshots: [
          {
            capturedAt: '2024-05-01T10:00:00Z',
            apiUptimePercent: 99.9,
            hitlResponseP95Seconds: 600,
            retrievalLatencyP95Seconds: 8,
            citationPrecisionP95: 0.98,
            notes: 'OK',
          },
        ],
      },
      incidents: {
        total: 1,
        open: 0,
        closed: 1,
        latest: {
          id: 'incident-1',
          occurredAt: '2024-04-10T09:00:00Z',
          detectedAt: '2024-04-10T09:05:00Z',
          resolvedAt: '2024-04-10T10:00:00Z',
          severity: 'medium',
          status: 'closed',
          title: 'Backlog reviewer',
          summary: 'SLA exceeded for 20 minutes.',
          impact: 'Delayed approvals',
          resolution: 'Added reviewers',
          followUp: 'Automate scaling',
          evidenceUrl: 'https://app.avocat-ai.example/governance/incident_response_plan.md',
          recordedAt: '2024-04-10T10:05:00Z',
        },
        entries: [
          {
            id: 'incident-1',
            occurredAt: '2024-04-10T09:00:00Z',
            detectedAt: '2024-04-10T09:05:00Z',
            resolvedAt: '2024-04-10T10:00:00Z',
            severity: 'medium',
            status: 'closed',
            title: 'Backlog reviewer',
            summary: 'SLA exceeded for 20 minutes.',
            impact: 'Delayed approvals',
            resolution: 'Added reviewers',
            followUp: 'Automate scaling',
            evidenceUrl: 'https://app.avocat-ai.example/governance/incident_response_plan.md',
            recordedAt: '2024-04-10T10:05:00Z',
          },
        ],
      },
      changeLog: {
        total: 1,
        latest: {
          id: 'change-1',
          entryDate: '2024-04-12',
          title: 'Updated playbook',
          category: 'policy',
          summary: 'Clarified escalation timeline.',
          releaseTag: '2024.04',
          links: null,
          recordedAt: '2024-04-12T14:00:00Z',
        },
        entries: [
          {
            id: 'change-1',
            entryDate: '2024-04-12',
            title: 'Updated playbook',
            category: 'policy',
            summary: 'Clarified escalation timeline.',
            releaseTag: '2024.04',
            links: null,
            recordedAt: '2024-04-12T14:00:00Z',
          },
        ],
      },
      goNoGo: {
        section: 'H',
        criteria: [
          {
            criterion: 'SLO snapshots capturés',
            autoSatisfied: true,
            recommendedEvidenceUrl: 'https://app.avocat-ai.example/governance/slo_and_support.md',
            recordedStatus: 'satisfied',
            recordedEvidenceUrl: 'https://app.avocat-ai.example/governance/slo_and_support.md',
            recordedNotes: null,
          },
          {
            criterion: 'Change log opérationnel publié',
            autoSatisfied: true,
            recommendedEvidenceUrl: 'https://app.avocat-ai.example/governance/change_management_playbook.md',
            recordedStatus: 'pending',
            recordedEvidenceUrl: null,
            recordedNotes: null,
          },
        ],
      },
    });
    fetchSsoConnectionsMock.mockResolvedValue({ connections: [] });
    fetchScimTokensMock.mockResolvedValue({ tokens: [] });
    fetchAuditEventsMock.mockResolvedValue({ events: [] });
    fetchIpAllowlistMock.mockResolvedValue({ entries: [] });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminView messages={messagesFr as Messages} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(fetchGovernanceMetricsMock).toHaveBeenCalled());

    expect(await screen.findByText(messagesFr.admin.provenanceJurisdictionTitle)).toBeInTheDocument();
    expect(await screen.findByText('France')).toBeInTheDocument();
    const identifiersTemplate =
      messagesFr.admin?.provenanceJurisdictionIdentifiers ?? 'ELI {eli} · ECLI {ecli}';
    const identifiersText = identifiersTemplate.replace('{eli}', '4').replace('{ecli}', '1');
    expect(await screen.findByText(identifiersText)).toBeInTheDocument();
    expect(
      await screen.findByText(messagesFr.admin.provenanceJurisdictionColumnResidency),
    ).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.operations.title)).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.operations.incidentsHeading)).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.retrievalTitle)).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.identifierTitle)).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.sloTitle)).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.policyResponsible)).toBeInTheDocument();

    expect(await screen.findByText(messagesFr.admin.sloSnapshotsTitle)).toBeInTheDocument();
    expect(
      await screen.findByText((content) =>
        content.includes(messagesFr.admin.sloLastCapture.split('{date}')[0]!.trim()),
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.policyEvidenceHint, { exact: false })).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.policySupport)).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.admin.policyRegulator)).toBeInTheDocument();
  });
});

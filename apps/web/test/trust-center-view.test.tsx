import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Messages } from '../src/lib/i18n';

const { getOperationsOverviewMock, getGovernancePublicationsMock } = vi.hoisted(() => ({
  getOperationsOverviewMock: vi.fn(),
  getGovernancePublicationsMock: vi.fn(),
}));

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesFr = JSON.parse(
  readFileSync(join(__dirname, '../messages/fr.json'), 'utf-8'),
) as Messages;

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
  return {
    ...actual,
    getOperationsOverview: getOperationsOverviewMock,
    getGovernancePublications: getGovernancePublicationsMock,
  };
});

const { TrustCenterView } = await import('../src/components/trust/trust-center-view');

describe('TrustCenterView', () => {
  beforeEach(() => {
    getOperationsOverviewMock.mockReset();
    getGovernancePublicationsMock.mockReset();
  });

  it('renders operations overview and governance publications', async () => {
    getOperationsOverviewMock.mockResolvedValue({
      slo: {
        summary: {
          snapshots: 2,
          latestCapture: '2024-05-02T08:00:00Z',
          apiUptimeP95: 99.9,
          hitlResponseP95Seconds: 540,
          retrievalLatencyP95Seconds: 7,
          citationPrecisionP95: 0.98,
        },
        snapshots: [
          {
            capturedAt: '2024-05-02T08:00:00Z',
            apiUptimePercent: 99.9,
            hitlResponseP95Seconds: 540,
            retrievalLatencyP95Seconds: 7,
            citationPrecisionP95: 0.98,
            notes: 'Stable release',
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
          resolvedAt: '2024-04-10T09:45:00Z',
          severity: 'low',
          status: 'closed',
          title: 'Cache warm-up delay',
          summary: 'Increased retrieval latency for 15 minutes.',
          impact: '',
          resolution: '',
          followUp: '',
          evidenceUrl: null,
          recordedAt: '2024-04-10T10:00:00Z',
        },
        entries: [],
      },
      changeLog: {
        total: 1,
        latest: {
          id: 'change-1',
          entryDate: '2024-04-12',
          title: 'Updated support rota',
          category: 'support',
          summary: 'Added EU evening coverage.',
          releaseTag: '2024.04',
          links: null,
          recordedAt: '2024-04-12T18:00:00Z',
        },
        entries: [],
      },
      goNoGo: {
        section: 'H',
        criteria: [
          {
            criterion: 'Support playbook published',
            autoSatisfied: true,
            recommendedEvidenceUrl: 'https://app.avocat-ai.example/governance/support_runbook.md',
            recordedStatus: 'satisfied',
            recordedEvidenceUrl: 'https://app.avocat-ai.example/governance/support_runbook.md',
            recordedNotes: null,
          },
        ],
      },
    });

    getGovernancePublicationsMock.mockResolvedValue({
      publications: [
        {
          slug: 'support-runbook',
          title: 'Support runbook',
          summary: 'Escalation paths and response targets.',
          doc_url: 'https://app.avocat-ai.example/governance/support_runbook.md',
          category: 'support',
          status: 'published',
          published_at: '2024-04-09T12:00:00Z',
          metadata: null,
        },
        {
          slug: 'regulator-plan',
          title: 'Regulator outreach plan',
          summary: null,
          doc_url: 'https://app.avocat-ai.example/governance/regulator_outreach_plan.md',
          category: 'regulator',
          status: 'published',
          published_at: '2024-04-01T09:00:00Z',
          metadata: null,
        },
      ],
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TrustCenterView messages={messagesFr as Messages} />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(getOperationsOverviewMock).toHaveBeenCalled());
    expect(await screen.findByText(messagesFr.trust.title)).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.trust.publicationsTitle)).toBeInTheDocument();
    expect(await screen.findByText('Support runbook')).toBeInTheDocument();
    expect(await screen.findByText('Regulator outreach plan')).toBeInTheDocument();
  });
});

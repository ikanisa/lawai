import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messagesFr from '../messages/fr.json';
import type { Messages } from '@/lib/i18n';
import { HitlView } from '@/features/hitl/components/hitl-view';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const {
  fetchHitlQueueMock,
  fetchHitlMetricsMock,
  fetchHitlDetailMock,
  fetchHitlAuditTrailMock,
  submitHitlActionMock,
} = vi.hoisted(() => {
  return {
    fetchHitlQueueMock: vi.fn(),
    fetchHitlMetricsMock: vi.fn(),
    fetchHitlDetailMock: vi.fn(),
    fetchHitlAuditTrailMock: vi.fn(),
    submitHitlActionMock: vi.fn(),
  };
});

type ApiModule = typeof import('../src/lib/api');

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<ApiModule>('../src/lib/api');
  return {
    ...actual,
    fetchHitlQueue: fetchHitlQueueMock,
    fetchHitlMetrics: fetchHitlMetricsMock,
    fetchHitlDetail: fetchHitlDetailMock,
    fetchHitlAuditTrail: fetchHitlAuditTrailMock,
    submitHitlAction: submitHitlActionMock,
  } satisfies ApiModule;
});

describe('HitlView metrics', () => {
  beforeEach(() => {
    fetchHitlQueueMock.mockReset();
    fetchHitlMetricsMock.mockReset();
    fetchHitlDetailMock.mockReset();
    fetchHitlAuditTrailMock.mockReset();
    submitHitlActionMock.mockReset();
  });

  it('renders fairness summary and flagged signals', async () => {
    fetchHitlQueueMock.mockResolvedValue({ items: [] });
    fetchHitlDetailMock.mockResolvedValue({
      hitl: { id: 'hitl-1', reason: 'Test', status: 'pending' },
      run: null,
      citations: [],
      retrieval: [],
      edits: [],
    });
    fetchHitlAuditTrailMock.mockResolvedValue({ events: [] });
    fetchHitlMetricsMock.mockResolvedValue({
      orgId: 'org-1',
      metrics: {
        queue: {
          reportDate: '2024-09-03T10:00:00Z',
          pending: 4,
          byType: { indexing_ticket: 2, guardrail_ticket: 2 },
          oldestCreatedAt: '2024-09-02T08:00:00Z',
          capturedAt: '2024-09-03T10:00:00Z',
        },
        drift: {
          reportDate: '2024-09-03T10:00:00Z',
          totalRuns: 12,
          highRiskRuns: 3,
          hitlEscalations: 4,
          allowlistedRatio: 0.92,
        },
        fairness: {
          reportDate: '2024-09-03T10:00:00Z',
          capturedAt: '2024-09-03T10:00:00Z',
          overall: { totalRuns: 12, hitlRate: 0.25, highRiskShare: 0.2, benchmarkRate: 0.75 },
          jurisdictions: [
            { code: 'FR', totalRuns: 6, hitlEscalations: 3, hitlRate: 0.5, highRiskShare: 0.25 },
            { code: 'QC', totalRuns: 6, hitlEscalations: 1, hitlRate: 0.16, highRiskShare: 0.1 },
          ],
          benchmarks: [{ name: 'LexGLUE', evaluated: 6, passRate: 0.6 }],
          flagged: { jurisdictions: ['FR'], benchmarks: ['LexGLUE'] },
          trend: [
            {
              reportDate: '2024-09-03T10:00:00Z',
              capturedAt: '2024-09-03T10:00:00Z',
              windowStart: '2024-09-02T00:00:00Z',
              windowEnd: '2024-09-03T00:00:00Z',
              overall: { totalRuns: 12, hitlRate: 0.25, highRiskShare: 0.2, benchmarkRate: 0.75 },
              jurisdictions: [
                { code: 'FR', totalRuns: 6, hitlEscalations: 3, hitlRate: 0.5, highRiskShare: 0.25 },
              ],
              benchmarks: [{ name: 'LexGLUE', evaluated: 6, passRate: 0.6 }],
              flagged: { jurisdictions: ['FR'], benchmarks: ['LexGLUE'] },
            },
          ],
        },
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <HitlView messages={messagesFr as Messages} locale="fr" />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(fetchHitlMetricsMock).toHaveBeenCalled());

    expect(await screen.findByText(messagesFr.hitl.metricsFairnessOverall)).toBeInTheDocument();
    const totalRunLabels = await screen.findAllByText(messagesFr.hitl.metricsFairnessTotalRuns);
    expect(totalRunLabels.length).toBeGreaterThan(0);
    expect(await screen.findByText(messagesFr.hitl.metricsQueueBreakdown)).toBeInTheDocument();
    expect(await screen.findByText('indexing ticket', { exact: false })).toBeInTheDocument();
    expect(await screen.findByText('LexGLUE')).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.hitl.metricsFairnessJurisdictions)).toBeInTheDocument();
    expect(await screen.findByText(messagesFr.hitl.metricsFairnessTrend)).toBeInTheDocument();
    expect(await screen.findByText(/Escalades : 3/)).toBeInTheDocument();
  });

  it('shows a loading state while metrics resolve', async () => {
    fetchHitlQueueMock.mockResolvedValue({ items: [] });
    fetchHitlDetailMock.mockResolvedValue({
      hitl: { id: 'hitl-1', reason: 'Test', status: 'pending' },
      run: null,
      citations: [],
      retrieval: [],
      edits: [],
    });
    fetchHitlAuditTrailMock.mockResolvedValue({ events: [] });
    fetchHitlMetricsMock.mockReturnValue(new Promise(() => {}));

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <HitlView messages={messagesFr as Messages} locale="fr" />
      </QueryClientProvider>,
    );

    expect(screen.getByText(messagesFr.hitl.metricsLoading)).toBeInTheDocument();
  });
});

describe('HitlView timeline', () => {
  beforeEach(() => {
    fetchHitlQueueMock.mockReset();
    fetchHitlMetricsMock.mockReset();
    fetchHitlDetailMock.mockReset();
    fetchHitlAuditTrailMock.mockReset();
    submitHitlActionMock.mockReset();
  });

  it('displays audit events for the selected review', async () => {
    fetchHitlQueueMock.mockResolvedValue({
      items: [
        {
          id: 'hitl-1',
          runId: 'run-1',
          reason: 'Analyse manuelle',
          status: 'pending',
          createdAt: '2024-09-03T09:00:00Z',
        },
      ],
    });
    fetchHitlDetailMock.mockResolvedValue({
      hitl: {
        id: 'hitl-1',
        reason: 'Analyse manuelle',
        status: 'pending',
        createdAt: '2024-09-03T09:00:00Z',
      },
      run: {
        id: 'run-1',
        orgId: 'org-1',
        question: 'La clause est-elle valable ?',
        jurisdiction: 'FR',
        irac: null,
        riskLevel: 'HIGH',
        status: 'pending',
        hitlRequired: true,
        startedAt: '2024-09-03T09:00:00Z',
        finishedAt: null,
      },
      citations: [
        {
          title: 'Code civil - Article 1240',
          publisher: 'Légifrance',
          url: 'https://legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417099/',
          domainOk: true,
          note: 'Officiel',
        },
      ],
      retrieval: [],
      edits: [],
    });
    fetchHitlAuditTrailMock.mockResolvedValue({
      events: [
        {
          id: 'audit-1',
          kind: 'hitl.action',
          object: 'hitl-1',
          created_at: '2024-09-03T10:00:00Z',
          actor_user_id: 'user-2',
          metadata: { status: 'approved', resolution_minutes: 12, comment: 'Validation manuelle' },
        },
      ],
    });
    fetchHitlMetricsMock.mockResolvedValue({ orgId: 'org-1', metrics: { queue: null, drift: null, fairness: null } });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <HitlView messages={messagesFr as Messages} locale="fr" />
      </QueryClientProvider>,
    );

    await waitFor(() => expect(fetchHitlDetailMock).toHaveBeenCalled());
    await waitFor(() => expect(fetchHitlAuditTrailMock).toHaveBeenCalled());

    expect(screen.getByText(messagesFr.hitl.timelineTitle)).toBeInTheDocument();
    expect(screen.getByText(/Validation manuelle/)).toBeInTheDocument();
    expect(screen.getByText(/approved/i)).toBeInTheDocument();
    expect(screen.getByText(/Par user-2/)).toBeInTheDocument();
  });
});

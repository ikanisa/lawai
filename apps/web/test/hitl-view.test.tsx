import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messagesFr from '../src/messages/fr.json';
import type { Messages } from '../src/lib/i18n';
import { HitlView } from '../src/components/hitl/hitl-view';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const fetchHitlQueueMock = vi.fn();
const fetchHitlMetricsMock = vi.fn();
const fetchMatterDetailMock = vi.fn();
const submitHitlActionMock = vi.fn();

type ApiModule = typeof import('../src/lib/api');

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<ApiModule>('../src/lib/api');
  return {
    ...actual,
    fetchHitlQueue: fetchHitlQueueMock,
    fetchHitlMetrics: fetchHitlMetricsMock,
    fetchMatterDetail: fetchMatterDetailMock,
    submitHitlAction: submitHitlActionMock,
  } satisfies ApiModule;
});

describe('HitlView metrics', () => {
  beforeEach(() => {
    fetchHitlQueueMock.mockReset();
    fetchHitlMetricsMock.mockReset();
    fetchMatterDetailMock.mockReset();
    submitHitlActionMock.mockReset();
  });

  it('renders fairness summary and flagged signals', async () => {
    fetchHitlQueueMock.mockResolvedValue({ items: [] });
    fetchMatterDetailMock.mockResolvedValue({ matter: { question: '', citations: [] } });
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
          overall: { totalRuns: 12, hitlRate: 0.25 },
          jurisdictions: [],
          benchmarks: [],
          flagged: { jurisdictions: ['FR'], benchmarks: ['LexGLUE'] },
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

    expect(screen.getByText(messagesFr.hitl.metricsFairnessOverall)).toBeInTheDocument();
    expect(screen.getByText(messagesFr.hitl.metricsFairnessTotalRuns)).toBeInTheDocument();
    expect(screen.getByText(/25%/)).toBeInTheDocument();
    expect(screen.getByText(messagesFr.hitl.metricsQueueBreakdown)).toBeInTheDocument();
    expect(screen.getByText('indexing ticket', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('LexGLUE')).toBeInTheDocument();
  });

  it('shows a loading state while metrics resolve', async () => {
    fetchHitlQueueMock.mockResolvedValue({ items: [] });
    fetchMatterDetailMock.mockResolvedValue({ matter: { question: '', citations: [] } });
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

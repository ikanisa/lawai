import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IRACPayload } from '@avocat-ai/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messagesEn from '../messages/en.json';
import type { Messages } from '../src/lib/i18n';
import type { AgentRunResponse } from '../src/lib/api';
import { ResearchView } from '../src/components/research/research-view';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('../src/hooks/use-online-status', () => ({
  useOnlineStatus: () => true,
}));

const { submitResearchQuestionMock, sendTelemetryEventMock } = vi.hoisted(() => ({
  submitResearchQuestionMock: vi.fn(),
  sendTelemetryEventMock: vi.fn(),
}));

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
  return {
    ...actual,
    submitResearchQuestion: submitResearchQuestionMock,
    sendTelemetryEvent: sendTelemetryEventMock,
  };
});

describe('ResearchView trust panel', () => {
  beforeEach(() => {
    submitResearchQuestionMock.mockReset();
    sendTelemetryEventMock.mockReset();
  });

  it('renders provenance information from the trust panel payload', async () => {
    const payload: IRACPayload = {
      jurisdiction: { country: 'FR', eu: true, ohada: false },
      issue: 'Validité',
      rules: [
        {
          citation: 'Code civil, art. 1240',
          source_url: 'https://www.legifrance.gouv.fr/eli/loi/2020/05/12/2020-1234/jo/texte',
          binding: true,
          effective_date: '2020-05-12',
        },
      ],
      application: 'Analyse synthétique',
      conclusion: 'La clause est valable.',
      citations: [
        {
          title: 'Code civil',
          court_or_publisher: 'Légifrance',
          date: '2020-05-12',
          url: 'https://www.legifrance.gouv.fr/eli/loi/2020/05/12/2020-1234/jo/texte',
          note: 'consolidé',
        },
      ],
      risk: { level: 'LOW', why: 'standard', hitl_required: false },
    };

    const mockResponse: AgentRunResponse = {
      runId: 'run-123',
      data: payload,
      verification: {
        status: 'passed',
        allowlistViolations: [],
        notes: [],
      },
      trustPanel: {
        citationSummary: {
          total: 2,
          allowlisted: 2,
          ratio: 1,
          nonAllowlisted: [],
          translationWarnings: ['Traduction informative à vérifier'],
          bindingNotes: {},
          rules: { total: 2, binding: 2, nonBinding: 0 },
        },
        retrievalSummary: {
          snippetCount: 2,
          fileSearch: 1,
          local: 1,
          topHosts: [{ host: 'legifrance.gouv.fr', count: 2 }],
        },
        caseQuality: {
          items: [],
          minScore: null,
          maxScore: null,
          forceHitl: false,
        },
        risk: {
          level: 'LOW',
          hitlRequired: false,
          reason: 'standard',
          verification: {
            status: 'passed',
            allowlistViolations: [],
            notes: [],
          },
        },
        provenance: {
          totalSources: 2,
          withEli: 1,
          withEcli: 0,
          residencyBreakdown: [{ zone: 'eu', count: 2 }],
          bindingLanguages: [{ language: 'fr', count: 2 }],
          akomaArticles: 5,
        },
      },
      plan: [],
      notices: [],
      reused: false,
    };

    submitResearchQuestionMock.mockResolvedValue(mockResponse);

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <ResearchView messages={messagesEn as Messages} locale="en" />
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByLabelText(messagesEn.research.heroPlaceholder), {
      target: { value: 'Analyse juridique' },
    });

    const form = screen.getByLabelText(messagesEn.research.heroPlaceholder).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => expect(submitResearchQuestionMock).toHaveBeenCalled());

    await waitFor(() =>
      expect(screen.getByText(messagesEn.research.trust.provenanceHeading)).toBeInTheDocument(),
    );

    const akomaText = messagesEn.research.trust.provenanceAkoma.replace('{count}', '5');
    expect(screen.getByText(akomaText)).toBeInTheDocument();
  });
});

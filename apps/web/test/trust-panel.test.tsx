import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IRACPayload } from '@avocat-ai/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messagesEn from '../messages/en.json';
import messagesFr from '../messages/fr.json';
import type { Messages } from '@/lib/i18n';
import type { AgentRunResponse } from '../src/lib/api';
import { ResearchView } from '@/features/research/components/research-view';
import { PwaInstallProvider } from '../src/hooks/use-pwa-install';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock('@/features/research/components/voice-input-button', () => ({
  VoiceInputButton: () => null,
}));

vi.mock('@/features/research/components/camera-ocr-button', () => ({
  CameraOcrButton: () => null,
}));

const { submitResearchQuestionMock, sendTelemetryEventMock, requestHitlReviewMock } = vi.hoisted(() => ({
  submitResearchQuestionMock: vi.fn(),
  sendTelemetryEventMock: vi.fn(),
  requestHitlReviewMock: vi.fn(),
}));

vi.mock('../src/lib/api', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/api')>('../src/lib/api');
  return {
    ...actual,
    submitResearchQuestion: submitResearchQuestionMock,
    sendTelemetryEvent: sendTelemetryEventMock,
    requestHitlReview: requestHitlReviewMock,
  };
});

describe('ResearchView trust panel', () => {
  beforeEach(() => {
    submitResearchQuestionMock.mockReset();
    sendTelemetryEventMock.mockReset();
    requestHitlReviewMock.mockReset();
  });

  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: { queries: { retry: false } },
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

    const queryClient = createQueryClient();

    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(
      <PwaInstallProvider>
        <QueryClientProvider client={queryClient}>
          <ResearchView messages={messagesEn as Messages} locale="en" />
        </QueryClientProvider>
      </PwaInstallProvider>,
    );

    await user.type(screen.getByLabelText(messagesEn.research.heroPlaceholder), 'Analyse juridique');
    await user.click(screen.getByRole('button', { name: messagesEn.actions.submit }));

    await waitFor(() => expect(submitResearchQuestionMock).toHaveBeenCalled());

    expect(
      await screen.findByText(messagesEn.research.trust.provenanceHeading),
    ).toBeInTheDocument();

    const akomaText = messagesEn.research.trust.provenanceAkoma.replace('{count}', '5');
    expect(screen.getByText(akomaText)).toBeInTheDocument();
  });

  it('surfaces Rwanda language notices and triage controls', async () => {
    const payload: IRACPayload = {
      jurisdiction: { country: 'RW', eu: false, ohada: false },
      issue: 'Applicabilité',
      rules: [
        {
          citation: 'Law No 001/2024',
          source_url: 'https://amategeko.gov.rw/law-001',
          binding: true,
          effective_date: '2024-01-01',
        },
      ],
      application: 'Analyse tri-langue.',
      conclusion: 'Applicable.',
      citations: [
        {
          title: 'Official Gazette',
          court_or_publisher: 'Rwanda Official Gazette',
          date: '2024-01-01',
          url: 'https://amategeko.gov.rw/law-001',
          note: 'Officiel',
        },
      ],
      risk: { level: 'LOW', why: 'standard', hitl_required: false },
    };

    const mockResponse: AgentRunResponse = {
      runId: 'run-rw',
      data: payload,
      verification: { status: 'passed', allowlistViolations: [], notes: [] },
      trustPanel: {
        citationSummary: {
          total: 1,
          allowlisted: 1,
          ratio: 1,
          nonAllowlisted: [],
          translationWarnings: [],
          bindingNotes: { fr: 'Traduction officielle' },
          rules: { total: 1, binding: 1, nonBinding: 0 },
        },
        retrievalSummary: { snippetCount: 1, fileSearch: 1, local: 0, topHosts: [] },
        caseQuality: { items: [], minScore: null, maxScore: null, forceHitl: false },
        risk: { level: 'LOW', hitlRequired: false, reason: 'standard', verification: { status: 'passed', allowlistViolations: [], notes: [] } },
        provenance: {
          totalSources: 1,
          withEli: 0,
          withEcli: 0,
          residencyBreakdown: [{ zone: 'rw', count: 1 }],
          bindingLanguages: [
            { language: 'fr', count: 1 },
            { language: 'en', count: 1 },
            { language: 'rw', count: 1 },
          ],
          akomaArticles: 0,
        },
      },
      plan: [],
      notices: [],
      reused: false,
    };

    submitResearchQuestionMock.mockResolvedValue(mockResponse);

    const queryClient = createQueryClient();
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(
      <PwaInstallProvider>
        <QueryClientProvider client={queryClient}>
          <ResearchView messages={messagesFr as Messages} locale="fr" />
        </QueryClientProvider>
      </PwaInstallProvider>,
    );

    await user.type(screen.getByLabelText(messagesFr.research.heroPlaceholder), 'Analyse tri-langue');
    await user.click(screen.getByRole('button', { name: messagesFr.actions.submit }));

    await waitFor(() => expect(submitResearchQuestionMock).toHaveBeenCalled());

    expect(
      await screen.findByText(messagesFr.research.rwandaLanguageNotice),
    ).toBeInTheDocument();
    const triage = messagesFr.research.rwanda;
    expect(await screen.findByText(triage.note)).toBeInTheDocument();

    const hyphenated = document.querySelector('.hyphenate-kinyarwanda');
    expect(hyphenated).not.toBeNull();
  });

  it('allows manual HITL requests from the risk banner', async () => {
    requestHitlReviewMock.mockResolvedValue({
      hitl: { id: 'hitl-123', status: 'pending', reason: null, created_at: null, updated_at: null },
      alreadyPending: false,
    });

    const payload: IRACPayload = {
      jurisdiction: { country: 'FR', eu: true, ohada: false },
      issue: 'Qualification du risque',
      rules: [
        {
          citation: 'Code civil, art. 1240',
          source_url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417930/',
          binding: true,
          effective_date: '2024-01-01',
        },
      ],
      application: 'Analyse synthétique du dossier.',
      conclusion: 'Revue humaine recommandée.',
      citations: [
        {
          title: 'Code civil',
          court_or_publisher: 'Légifrance',
          date: '2024-01-01',
          url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006417930/',
          note: 'consolidé',
        },
      ],
      risk: { level: 'MEDIUM', why: 'Clause litigieuse détectée', hitl_required: false },
    };

    const mockResponse: AgentRunResponse = {
      runId: 'run-hitl',
      data: payload,
      verification: { status: 'passed', allowlistViolations: [], notes: [] },
      trustPanel: {
        citationSummary: {
          total: 1,
          allowlisted: 1,
          ratio: 1,
          nonAllowlisted: [],
          translationWarnings: [],
          bindingNotes: {},
          rules: { total: 1, binding: 1, nonBinding: 0 },
        },
        retrievalSummary: {
          snippetCount: 1,
          fileSearch: 1,
          local: 0,
          topHosts: [{ host: 'legifrance.gouv.fr', count: 1 }],
        },
        caseQuality: {
          items: [],
          minScore: null,
          maxScore: null,
          forceHitl: false,
        },
        risk: {
          level: 'MEDIUM',
          hitlRequired: false,
          reason: 'Clause litigieuse détectée',
          verification: { status: 'passed', allowlistViolations: [], notes: [] },
        },
        provenance: {
          totalSources: 1,
          withEli: 1,
          withEcli: 0,
          residencyBreakdown: [{ zone: 'eu', count: 1 }],
          bindingLanguages: [{ language: 'fr', count: 1 }],
          akomaArticles: 0,
        },
      },
      plan: [],
      notices: [],
      reused: false,
    };

    submitResearchQuestionMock.mockResolvedValue(mockResponse);

    const queryClient = createQueryClient();
    const user = userEvent.setup({ pointerEventsCheck: 0 });

    render(
      <PwaInstallProvider>
        <QueryClientProvider client={queryClient}>
          <ResearchView messages={messagesEn as Messages} locale="en" />
        </QueryClientProvider>
      </PwaInstallProvider>,
    );

    await user.type(screen.getByLabelText(messagesEn.research.heroPlaceholder), 'Analyse HITL');
    await user.click(screen.getByRole('button', { name: messagesEn.actions.submit }));

    await user.click(await screen.findByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    });

    const hitlButton = await screen.findByRole('button', { name: messagesEn.actions.hitl });
    expect(hitlButton).toBeEnabled();

    await user.click(hitlButton);

    await waitFor(() =>
      expect(requestHitlReviewMock).toHaveBeenCalledWith(
        'run-hitl',
        expect.objectContaining({ reason: expect.any(String) }),
      ),
    );

    expect(requestHitlReviewMock).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: messagesEn.actions.hitlQueued })).toBeDisabled(),
    );

    expect(sendTelemetryEventMock).toHaveBeenCalledWith(
      'hitl_requested',
      expect.objectContaining({ runId: 'run-hitl', manual: true, alreadyPending: false }),
    );
  });
});

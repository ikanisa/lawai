import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IRACPayload } from '@avocat-ai/shared';

import { ResearchResultsPane } from '@/features/research/components/irac-results-pane';
import type { ResearchResultsPaneProps } from '@/features/research/components/irac-results-pane';
import type { Messages } from '@/lib/i18n';
import messagesEn from '../messages/en.json';
import messagesFr from '../messages/fr.json';
import { createResearchResultsPaneProps } from './fixtures/research-results-pane';

describe('ResearchResultsPane trust integrations', () => {
  const messagesEnTyped = messagesEn as Messages;
  const messagesFrTyped = messagesFr as Messages;

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      configurable: true,
    });
  });

  const renderPane = (overrides: Partial<ResearchResultsPaneProps> = {}) => {
    const props = createResearchResultsPaneProps({
      researchMessages: messagesEnTyped.research,
      ...overrides,
    });
    render(<ResearchResultsPane {...props} />);
    return props;
  };

  it('renders trust summaries, allowlist details, and source hosts', () => {
    const trustMessages = messagesEnTyped.research.trust;
    const allowlistStats = trustMessages.allowlistStats
      .replace('{allowlisted}', '3')
      .replace('{total}', '3')
      .replace('{ratio}', '100');
    const riskLabel = trustMessages.riskLabel.replace('{level}', trustMessages.riskLevels.LOW);
    const hostLabel = trustMessages.sourceHostMultiple
      .replace('{host}', 'legifrance.gouv.fr')
      .replace('{count}', '2');

    const props = renderPane({
      readingMode: 'research',
      trustSummary: {
        verificationMessage: trustMessages.verificationPassed,
        verificationNotes: [{ code: 'note', message: 'Pending verification' }],
        allowlistSummary: trustMessages.allowlistClean,
        allowlistDetails: ['legifrance.gouv.fr'],
        allowlistStats,
        translationSummary: trustMessages.translationWarnings,
        translationWarnings: ['Check translation'],
        bindingSummary: trustMessages.bindingWarnings,
        bindingCountsMessage: trustMessages.bindingCounts
          .replace('{binding}', '2')
          .replace('{total}', '4'),
        planSummary: trustMessages.planReused,
        riskLabelSummary: riskLabel,
        hitlSummary: trustMessages.hitlNotRequired,
        citationHosts: [{ host: 'legifrance.gouv.fr', count: 2 }],
      },
      noticeMessages: ['Manual notice'],
    });

    expect(screen.getByText(trustMessages.verificationPassed)).toBeInTheDocument();
    expect(screen.getByText('Pending verification')).toBeInTheDocument();
    expect(screen.getByText(trustMessages.allowlistClean)).toBeInTheDocument();
    expect(screen.getByText(allowlistStats)).toBeInTheDocument();
    expect(screen.getAllByText('Manual notice')).toHaveLength(2);
    expect(screen.getByText(hostLabel)).toBeInTheDocument();
    expect(screen.getByText(trustMessages.hitlNotRequired)).toBeInTheDocument();
    expect(props.trustSummary.citationHosts).toHaveLength(1);
  });

  it('displays Rwanda triage controls and hyphenated typography', async () => {
    const researchMessages = messagesFrTyped.research;
    const rwandaPayload: IRACPayload = {
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
      risk: { level: 'LOW', why: 'Edition officielle', hitl_required: false },
    };

    renderPane({
      researchMessages,
      payload: rwandaPayload,
      isRwanda: true,
      readingMode: 'brief',
      hyphenatedClass: 'hyphenate-kinyarwanda',
    });

    expect(
      screen.getByText(researchMessages.rwandaLanguageNotice ?? ''),
    ).toBeInTheDocument();
    expect(screen.getByText(researchMessages.rwanda?.note ?? '')).toBeInTheDocument();
    expect(document.querySelector('.hyphenate-kinyarwanda')).not.toBeNull();
  });

  it('allows manual HITL requests from the risk banner', async () => {
    const user = userEvent.setup();
    const hitlHandler = vi.fn();

    const riskPayload: IRACPayload = {
      jurisdiction: { country: 'FR', eu: true, ohada: false },
      issue: 'Qualification du risque',
      rules: [
        {
          citation: 'Code civil, art. 1240',
          source_url: 'https://www.legifrance.gouv.fr/code/article_lc/LEGIARTI000006417930/',
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
          url: 'https://www.legifrance.gouv.fr/code/article_lc/LEGIARTI000006417930/',
          note: 'consolidé',
        },
      ],
      risk: { level: 'MEDIUM', why: 'Clause litigieuse détectée', hitl_required: false },
    };

    renderPane({
      payload: riskPayload,
      readingMode: 'research',
      hitlButtonLabel: (messagesEnTyped.actions?.hitl as string) ?? 'Submit for review',
      onHitlRequest: hitlHandler,
    });

    const hitlButton = await screen.findByRole('button', {
      name: (messagesEnTyped.actions?.hitl as string) ?? 'Submit for review',
    });
    await user.click(hitlButton);

    expect(hitlHandler).toHaveBeenCalledTimes(1);
  });
});

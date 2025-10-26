import { render, screen, fireEvent } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import messagesFr from '../messages/fr.json';
import type { Messages } from '@/lib/i18n';
import { RedlineDiff, type RedlineEntry } from '@/features/drafting/components/redline-diff';

describe('RedlineDiff', () => {
  beforeAll(() => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  const messages = (messagesFr as Messages).drafting.redlineViewer;

  const entries: RedlineEntry[] = [
    {
      id: 'e1',
      title: 'Garantie',
      original: 'La garantie est de 12 mois.',
      revised: 'La garantie est de 24 mois.',
      impact: 'Allonge la garantie.',
      status: 'accepted',
      risk: 'low',
      citations: [],
    },
    {
      id: 'e2',
      title: 'Clause compromissoire',
      original: 'Tribunal de Paris compétent.',
      revised: 'Compétence CCJA.',
      impact: 'Change la juridiction.',
      status: 'flagged',
      risk: 'high',
      citations: ['https://www.ohada.org'],
    },
  ];

  it('renders summary counts and flagged hint', () => {
    render(<RedlineDiff entries={entries} messages={messages} />);

    expect(screen.getByText(messages.acceptedLabel)).toBeInTheDocument();
    expect(screen.getByText(messages.flaggedHelp)).toBeInTheDocument();
    expect(screen.getByText(messages.flaggedCount.replace('{count}', '1'))).toBeInTheDocument();
  });

  it('toggles detailed view from summary on mobile', () => {
    render(<RedlineDiff entries={entries} messages={messages} />);

    const openDetail = screen.getByRole('button', { name: messages.toggleDetail });
    fireEvent.click(openDetail);

    expect(screen.getByText(messages.detailTitle)).toBeInTheDocument();
    const normalize = (value: string | null | undefined) => value?.replace(/\s+/g, ' ').trim() ?? '';
    const beforeSection = screen.getByText(messages.beforeLabel).closest('section');
    const afterSection = screen.getByText(messages.afterLabel).closest('section');
    expect(normalize(beforeSection?.textContent)).toContain(normalize(entries[0].original));
    expect(normalize(afterSection?.textContent)).toContain(normalize(entries[0].revised));

    const toggleSummaryLabel = messages.toggleSummary ?? 'Revenir au résumé';
    const [backButton] = screen.getAllByRole('button', { name: toggleSummaryLabel });
    fireEvent.click(backButton);

    expect(screen.getByText(messages.summaryTitle)).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { RwandaLanguageTriage, type RwandaLanguageMessages } from '@/features/research/components/rwanda-language-triage';

const messages: RwandaLanguageMessages = {
  label: 'Versions officielles du Rwanda',
  description: 'Choisissez la langue de lecture pour vérifier la concordance des textes.',
  note: 'Les éditions française, anglaise et kinyarwanda ont la même force juridique.',
  languages: {
    fr: 'Français',
    en: 'Anglais',
    rw: 'Kinyarwanda',
  },
};

describe('RwandaLanguageTriage', () => {
  it('renders tri-language controls and emits selection events', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(<RwandaLanguageTriage messages={messages} onSelect={onSelect} />);

    expect(screen.getByText(messages.label)).toBeInTheDocument();
    expect(screen.getByText(messages.note)).toBeInTheDocument();
    const frenchButton = screen.getByRole('button', { name: messages.languages.fr });
    const englishButton = screen.getByRole('button', { name: messages.languages.en });
    const kinyarwandaButton = screen.getByRole('button', { name: messages.languages.rw });

    await act(async () => {
      await user.click(englishButton);
    });
    expect(onSelect).toHaveBeenLastCalledWith('en');

    await act(async () => {
      await user.click(kinyarwandaButton);
    });
    expect(onSelect).toHaveBeenLastCalledWith('rw');

    await act(async () => {
      await user.click(frenchButton);
    });
    expect(onSelect).toHaveBeenLastCalledWith('fr');
    expect(onSelect).toHaveBeenCalledTimes(3);
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReadingModeToggle } from '../src/components/research/reading-mode-toggle';

const labels = {
  label: 'Modes de lecture',
  research: 'Recherche',
  brief: 'Mémo',
  evidence: 'Preuves',
};

const descriptions = {
  research: 'Vue complète',
  brief: 'Résumé rapide',
  evidence: 'Focus preuves',
} as const;

describe('ReadingModeToggle', () => {
  it('calls onChange when selecting a different mode', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<ReadingModeToggle mode="research" onChange={handleChange} labels={labels} descriptions={descriptions} />);

    await user.click(screen.getByRole('radio', { name: labels.brief }));

    expect(handleChange).toHaveBeenCalledWith('brief');
  });

  it('renders the active description', () => {
    render(<ReadingModeToggle mode="evidence" onChange={() => {}} labels={labels} descriptions={descriptions} />);

    expect(screen.getByText(descriptions.evidence)).toBeInTheDocument();
  });
});

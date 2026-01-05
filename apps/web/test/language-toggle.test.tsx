import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BilingualToggle } from '../src/components/bilingual-toggle';

describe('BilingualToggle', () => {
  it('renders provided languages and emits selection events', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <BilingualToggle
        messages={{
          label: 'Official versions',
          fr: 'Français',
          en: 'English',
          note: 'Choose an official language.',
        }}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole('button', { name: /Français/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /English/i }));
    expect(onSelect).toHaveBeenCalledWith('en');
  });
});

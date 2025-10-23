import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import messagesEn from '../messages/en.json';
import type { Messages } from '@/lib/i18n';
import { CommandPalette } from '@/components/command-palette';
import { useCommandPalette } from '../src/state/command-palette';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => '/en/workspace',
}));

describe('CommandPalette accessibility', () => {
  beforeEach(() => {
    pushMock.mockReset();
    act(() => {
      useCommandPalette.getState().setOpen(false);
    });
  });

  function openPalette() {
    render(<CommandPalette messages={messagesEn as Messages} locale="en" />);
    act(() => {
      useCommandPalette.getState().setOpen(true);
    });
    const input = screen.getByRole('combobox');
    input.focus();
    return input as HTMLInputElement;
  }

  it('updates the active descendant when navigating with arrow keys', async () => {
    const input = openPalette();
    const listbox = screen.getByRole('listbox');

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', 'command-option-action-drafting');
      expect(listbox).toHaveAttribute('aria-activedescendant', 'command-option-action-drafting');
    });

    const firstOption = document.getElementById('command-option-action-drafting');
    expect(firstOption).not.toBeNull();
    expect(firstOption).toHaveAttribute('aria-selected', 'true');

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', 'command-option-action-hitl');
    });
    expect(listbox).toHaveAttribute('aria-activedescendant', 'command-option-action-hitl');

    const secondOption = document.getElementById('command-option-action-hitl');
    expect(secondOption).not.toBeNull();
    await waitFor(() => {
      expect(secondOption).toHaveAttribute('aria-selected', 'true');
      expect(firstOption).toHaveAttribute('aria-selected', 'false');
    });
  });

  it('announces the number of semantic matches after each query change', async () => {
    const input = openPalette();
    const status = screen.getByRole('status');

    await waitFor(() => {
      expect(status.textContent).toBe('Found 4 matching command(s).');
    });

    fireEvent.change(input, { target: { value: 'work' } });

    await waitFor(() => {
      expect(status.textContent).toBe('Found 1 matching command(s).');
    });
  });
});

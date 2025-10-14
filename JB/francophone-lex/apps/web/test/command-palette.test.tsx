import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messagesEn from '../messages/en.json';
import type { Messages } from '../src/lib/i18n';
import { CommandPalette } from '../src/components/command-palette';
import { useCommandPalette } from '../src/state/command-palette';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
  usePathname: () => '/en/workspace',
}));

describe('CommandPalette', () => {
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
  }

  it('shows navigation commands when opened', () => {
    openPalette();

    expect(screen.getByText(messagesEn.app.commandPalette.title)).toBeInTheDocument();
    expect(screen.getByText(messagesEn.app.commandPalette.sections.navigate)).toBeInTheDocument();
    expect(screen.getAllByText(messagesEn.nav.workspace).length).toBeGreaterThan(0);
    expect(screen.getByText(messagesEn.app.commandPalette.sections.actions)).toBeInTheDocument();
  });

  it('filters commands based on search input', () => {
    openPalette();

    const search = screen.getByPlaceholderText(messagesEn.app.commandPalette.placeholder);
    fireEvent.change(search, { target: { value: 'HITL' } });

    expect(screen.getByText(messagesEn.nav.hitl)).toBeInTheDocument();
    return waitFor(() => {
      expect(screen.queryByText(messagesEn.nav.drafting)).not.toBeInTheDocument();
    });
  });

  it('executes the selected command and closes the palette', () => {
    openPalette();

    const researchButton = screen.getByText(messagesEn.nav.research);
    fireEvent.click(researchButton);

    expect(pushMock).toHaveBeenCalledWith('/en/research');
    expect(useCommandPalette.getState().open).toBe(false);
  });
});

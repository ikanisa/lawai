import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messagesEn from '../messages/en.json';
import type { Messages } from '@/lib/i18n';
import { CommandPalette } from '@/features/shell';
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

    expect(screen.getByText(messagesEn.commands.title)).toBeInTheDocument();
    expect(screen.getByText(messagesEn.commands.groupNavigation)).toBeInTheDocument();
    expect(screen.getByText(messagesEn.commands.workspace)).toBeInTheDocument();
    expect(screen.getByText(messagesEn.commands.groupActions)).toBeInTheDocument();
  });

  it('filters commands based on search input', () => {
    openPalette();

    const search = screen.getByPlaceholderText(messagesEn.commands.searchPlaceholder);
    fireEvent.change(search, { target: { value: 'HITL' } });

    expect(screen.getByText(messagesEn.commands.hitl)).toBeInTheDocument();
    return waitFor(() => {
      expect(screen.queryByText(messagesEn.commands.drafting)).not.toBeInTheDocument();
    });
  });

  it('executes the selected command and closes the palette', () => {
    openPalette();

    const researchButton = screen.getByText(messagesEn.commands.research);
    fireEvent.click(researchButton);

    expect(pushMock).toHaveBeenCalledWith('/en/research');
    expect(useCommandPalette.getState().open).toBe(false);
  });
});

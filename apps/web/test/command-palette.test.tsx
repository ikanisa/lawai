import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import messagesEn from '../messages/en.json';
import type { Messages } from '../src/lib/i18n';
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

  const actions = [
    { id: 'action-drafting', label: 'Drafting', section: 'actions', href: '/drafting' },
    { id: 'action-hitl', label: 'HITL review', section: 'actions', href: '/hitl' },
    { id: 'nav-workspace', label: 'Workspace', section: 'navigate', href: '/workspace' },
    { id: 'nav-research', label: 'Research', section: 'navigate', href: '/research' },
  ];

  function openPalette() {
    render(<CommandPalette messages={messagesEn as Messages} locale="en" actions={actions} />);
    act(() => {
      useCommandPalette.getState().setOpen(true);
    });
  }

  it('shows navigation commands when opened', () => {
    openPalette();

    expect(screen.getByText(messagesEn.app.commandPalette.title)).toBeInTheDocument();
    expect(screen.getByText(messagesEn.app.commandPalette.sections.navigate)).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText(messagesEn.app.commandPalette.sections.actions)).toBeInTheDocument();
  });

  it('filters commands based on search input', () => {
    openPalette();

    const search = screen.getByPlaceholderText(messagesEn.app.commandPalette.placeholder);
    fireEvent.change(search, { target: { value: 'HITL' } });

    expect(screen.getByText('HITL review')).toBeInTheDocument();
    return waitFor(() => {
      expect(screen.queryByText('Drafting')).not.toBeInTheDocument();
    });
  });

  it('executes the selected command and closes the palette', () => {
    openPalette();

    const researchButton = screen.getByText('Research');
    fireEvent.click(researchButton);

    expect(pushMock).toHaveBeenCalledWith('/en/research');
    expect(useCommandPalette.getState().open).toBe(false);
  });
});

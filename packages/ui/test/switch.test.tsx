import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Switch, UiThemeProvider } from '../src/index.js';

afterEach(() => {
  cleanup();
});

describe('Switch', () => {
  it('invokes onCheckedChange in web theme', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      React.createElement(
        UiThemeProvider,
        { theme: 'web' },
        React.createElement(Switch, { checked: true, label: 'Toggle', onCheckedChange: handleChange }),
      ),
    );

    const button = screen.getByRole('switch', { name: /toggle/i });
    await user.click(button);
    expect(handleChange).toHaveBeenCalledWith(false);
  });

  it('toggles visual state in pwa theme', async () => {
    const user = userEvent.setup();

    render(
      React.createElement(
        UiThemeProvider,
        { theme: 'pwa' },
        React.createElement(Switch, { defaultChecked: true, label: 'Toggle' }),
      ),
    );

    const switchRoot = screen.getByRole('switch');
    expect(switchRoot).toHaveAttribute('aria-checked', 'true');
    await user.click(switchRoot);
    await waitFor(() => {
      expect(switchRoot).toHaveAttribute('aria-checked', 'false');
    });
  });
});

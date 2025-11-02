import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, UiThemeProvider } from '../src/index.js';

describe('Button', () => {
  it('applies web theme styles by default', () => {
    render(
      React.createElement(
        UiThemeProvider,
        { theme: 'web' },
        React.createElement(Button, null, 'Click me'),
      ),
    );

    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toHaveClass('bg-primary');
  });

  it('renders pwa styles when theme is pwa', () => {
    render(
      React.createElement(
        UiThemeProvider,
        { theme: 'pwa' },
        React.createElement(Button, null, 'Action'),
      ),
    );

    const button = screen.getByRole('button', { name: /action/i });
    expect(button.className).toContain('bg-gradient-primary');
  });
});

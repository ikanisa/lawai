import type { Preview } from '@storybook/react';
import React from 'react';

import { UiThemeProvider, type UiTheme } from '../src/index.js';

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'UI theme',
      defaultValue: 'web',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'web', title: 'Web' },
          { value: 'pwa', title: 'PWA' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = (context.globals.theme as UiTheme) ?? 'web';
      const background = theme === 'pwa' ? '#040B1A' : '#0F172A';
      return (
        <UiThemeProvider theme={theme}>
          <div style={{ padding: '2rem', backgroundColor: background, minHeight: '100vh' }}>
            <Story />
          </div>
        </UiThemeProvider>
      );
    },
  ],
};

export default preview;

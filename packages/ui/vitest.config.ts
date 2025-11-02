import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const utilsSourcePath = fileURLToPath(new URL('../utils/src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react({ jsxRuntime: 'automatic', jsxImportSource: 'react' })],
  resolve: {
    alias: {
      '@avocat-ai/utils': utilsSourcePath,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
    },
  },
});

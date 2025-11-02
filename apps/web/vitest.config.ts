import { defineConfig } from 'vitest/config';
import path from 'node:path';

const resolveFromRoot = (relativePath: string) => path.resolve(__dirname, relativePath);

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['test/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      inline: ['@testing-library/jest-dom', 'react', 'react-dom'],
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov'],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    exclude: ['playwright/**/*', 'tests/**/*'],
  },
  resolve: {
    alias: {
      '@': resolveFromRoot('./src'),
      '@avocat-ai/shared': resolveFromRoot('../../packages/shared/src/index.ts'),
    },
  },
});

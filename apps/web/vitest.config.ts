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
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
    },
  },
  resolve: {
    alias: {
      '@': resolveFromRoot('./src'),
      '@avocat-ai/shared': resolveFromRoot('../../packages/shared/src/index.ts'),
      react: resolveFromRoot('../../node_modules/react'),
      'react-dom': resolveFromRoot('../../node_modules/react-dom'),
      'react/jsx-runtime': resolveFromRoot('../../node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': resolveFromRoot('../../node_modules/react/jsx-dev-runtime.js'),
    },
  },
});

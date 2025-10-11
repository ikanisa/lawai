import { defineConfig } from 'vitest/config';
import path from 'node:path';

const resolveFromRoot = (relativePath: string) => path.resolve(__dirname, relativePath);

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      reporter: ['text'],
    },
    include: ['test/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@avocat-ai/shared': resolveFromRoot('../../packages/shared/src/index.ts'),
      '@avocat-ai/supabase': resolveFromRoot('../../packages/supabase/src/index.ts'),
    },
  },
});

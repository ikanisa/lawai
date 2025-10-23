import { defineConfig } from 'vitest/config';
import path from 'node:path';

const resolveFromRoot = (relativePath: string) => path.resolve(__dirname, relativePath);

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup-env.ts'],
  },
  resolve: {
    alias: {
      '@avocat-ai/shared': resolveFromRoot('../../packages/shared/src'),
      '@avocat-ai/shared/transparency': resolveFromRoot('../../packages/shared/src/transparency.ts'),
      '@avocat-ai/shared/scheduling': resolveFromRoot('../../packages/shared/src/scheduling.ts'),
      '@avocat-ai/supabase': resolveFromRoot('../../packages/supabase/src/index.ts'),
    },
  },
});

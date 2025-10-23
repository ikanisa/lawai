import { defineConfig } from 'vitest/config';
import path from 'node:path';

const resolveFromRoot = (relativePath: string) => path.resolve(__dirname, relativePath);

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      OPENAI_API_KEY: 'sk-live-1234567890abcdef1234567890abcdef',
      SUPABASE_URL: 'https://supabase.lawai.test',
      SUPABASE_SERVICE_ROLE_KEY:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-service-role-key-for-tests',
      OPENAI_VECTOR_STORE_AUTHORITIES_ID: 'vs_lawai_authorities_mock',
    },
    coverage: {
      reporter: ['text'],
    },
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup-env.ts'],
  },
  resolve: {
    alias: {
      '@avocat-ai/shared': resolveFromRoot('../../packages/shared/src/index.ts'),
      '@avocat-ai/supabase': resolveFromRoot('../../packages/supabase/src/index.ts'),
    },
  },
});

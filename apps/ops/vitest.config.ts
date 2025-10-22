import { defineConfig } from 'vitest/config';
import path from 'node:path';

const resolveFromRoot = (relativePath: string) => path.resolve(__dirname, relativePath);

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'test-openai-key',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-1234567890abcdef1234567890abcd',
      SUPABASE_DB_URL: 'postgresql://postgres:postgres@example.supabase.co:5432/postgres',
      EMBEDDING_DIMENSION: '1536',
    },
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

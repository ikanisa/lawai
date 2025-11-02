import { defineConfig } from 'vitest/config';
import path from 'node:path';

const resolveFromRoot = (relativePath: string) => path.resolve(__dirname, relativePath);

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      OPENAI_API_KEY: 'test-key',
      AGENT_MODEL: 'gpt-test',
      EMBEDDING_MODEL: 'text-embedding-test',
      OPENAI_VECTOR_STORE_AUTHORITIES_ID: 'vs_test',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role',
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
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup-env.ts'],
  },
  resolve: {
    alias: {
      '@avocat-ai/shared': resolveFromRoot('../../packages/shared/src/index.ts'),
      '@avocat-ai/supabase': resolveFromRoot('../../packages/supabase/src/index.ts'),
      '@avocat-ai/observability': resolveFromRoot('../../packages/observability/src/index.ts'),
      '@avocat-ai/agent-kernel': resolveFromRoot('../../packages/agent-kernel/src/index.ts'),
    },
  },
});

import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(process.cwd(), '.env.test') });
loadEnv({ path: path.resolve(process.cwd(), '.env') });

const apiPort = Number(process.env.API_PORT ?? 3333);
const appPort = Number(process.env.APP_PORT ?? 3000);
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  throw new Error('Playwright configuration requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const nextPublicApiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${appPort}`,
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    extraHTTPHeaders: {
      'x-org-id': '00000000-0000-0000-0000-000000000000',
      'x-user-id': '00000000-0000-0000-0000-000000000000',
    },
  },
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: [
    {
      command: `PORT=${apiPort} NODE_ENV=development AGENT_STUB_MODE=always npm run dev --workspace @apps/api`,
      port: apiPort,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: String(apiPort),
        SUPABASE_URL: supabaseUrl,
        SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRole,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'test-openai-key',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: `PORT=${appPort} NEXT_PUBLIC_API_BASE_URL=${nextPublicApiBase} npm run dev --workspace @avocat-ai/web`,
      port: appPort,
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: String(appPort),
        NEXT_PUBLIC_API_BASE_URL: nextPublicApiBase,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  timeout: 60_000,
});

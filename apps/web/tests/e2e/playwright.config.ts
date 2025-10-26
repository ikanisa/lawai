import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../../..');

const envFiles = [
  path.join(repoRoot, '.env.test.local'),
  path.join(repoRoot, '.env.test'),
  path.join(repoRoot, '.env.local'),
  path.join(repoRoot, '.env'),
];

for (const file of envFiles) {
  if (fs.existsSync(file)) {
    loadEnv({ path: file, override: false });
  }
}

const apiPort = Number.parseInt(process.env.E2E_API_PORT ?? '3333', 10);
const webPort = Number.parseInt(process.env.E2E_WEB_PORT ?? '3000', 10);
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? `http://127.0.0.1:${apiPort}`;
process.env.NEXT_PUBLIC_API_BASE_URL = apiBaseUrl;

export default defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: process.env.CI ? 'github' : [['list']],
  globalSetup: path.resolve(__dirname, './global-setup.ts'),
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @apps/api dev',
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(apiPort),
        LOG_LEVEL: process.env.LOG_LEVEL ?? 'warn',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'test-openai-key',
      },
      port: apiPort,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @avocat-ai/web dev',
      cwd: repoRoot,
      env: {
        ...process.env,
        PORT: String(webPort),
        NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
      },
      port: webPort,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});

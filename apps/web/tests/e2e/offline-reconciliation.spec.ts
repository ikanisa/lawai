import { test, expect } from '@playwright/test';

const agentRunResponse = {
  runId: 'run-offline-replay',
  data: {
    jurisdiction: { country: 'FR', code: 'FR' },
    risk: {
      level: 'LOW',
      hitl_required: false,
      reason: 'Queued request replayed',
      verification: { status: 'passed', notes: [], allowlistViolations: [] },
    },
    issue: 'FR civil intake summary',
    rules: [],
    application: [],
    conclusion: 'Ready for drafting',
  },
  plan: [],
  notices: [],
  reused: false,
};

test.describe('Offline research reconciliation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/telemetry', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('**/runs', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(agentRunResponse) });
    });
  });

  test('queues research offline and flushes when connectivity returns', async ({ page, context }) => {
    await page.goto('/en/research');

    await context.setOffline(true);

    await page.getByPlaceholder('Ask your legal question…').fill('What protections apply to FRIA cases?');
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(page.getByRole('heading', { name: 'Offline queue' })).toBeVisible();
    await expect(page.getByText('What protections apply to FRIA cases?')).toBeVisible();

    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByText('Still offline. Retry when the network is back.')).toBeVisible();

    await context.setOffline(false);

    await page.getByRole('button', { name: 'Retry' }).click();

    await expect(page.getByText('Analysis ready')).toBeVisible();
    await expect(page.getByText('No pending research.')).toBeVisible();
  });
});

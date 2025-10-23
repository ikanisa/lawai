import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('renders localized workspace shell', async ({ page }) => {
    await page.goto('/en/workspace');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByText(/workspace/i)).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

test.describe('smoke', () => {
  test('renders localized workspace shell', async ({ page }) => {
    await page.goto('/en/workspace');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByText(/workspace/i)).toBeVisible();
  });

  test('loads research view with command palette', async ({ page }) => {
    await page.goto('/en/research');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByRole('button', { name: /command/i })).toBeVisible();
    await expect(page.getByPlaceholder(/question/i)).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('WhatsApp authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/telemetry', (route) => route.fulfill({ status: 204, body: '' }));
  });

  test('requests and verifies a WhatsApp OTP for workspace access', async ({ page }) => {
    await page.route('**/auth/whatsapp/start', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ verificationId: 'ver-123', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
      });
    });

    await page.route('**/auth/whatsapp/verify', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ session_token: 'session-verified', wa_id: 'whatsapp:+33123456789' }),
      });
    });

    await page.goto('/en/auth');

    await page.getByLabel('WhatsApp number').fill('+33123456789');
    await page.getByRole('button', { name: 'Send code' }).click();

    await expect(page.getByText('Enter the 6-digit code we sent to WhatsApp')).toBeVisible();

    await page.getByPlaceholder('One-time code').fill('123456');
    await page.getByRole('button', { name: 'Verify code' }).click();

    await expect(page.getByText('Workspace access confirmed.')).toBeVisible();
    await expect(page.getByText('session-verified')).toBeVisible();
  });
});

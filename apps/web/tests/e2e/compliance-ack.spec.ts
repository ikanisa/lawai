import { test, expect } from '@playwright/test';

const DEFAULT_ID = '00000000-0000-0000-0000-000000000000';
const DEFAULT_VERSION = '2024.09';

const orgId = process.env.E2E_ORG_ID ?? DEFAULT_ID;
const userId = process.env.E2E_USER_ID ?? DEFAULT_ID;
const consentVersion = process.env.E2E_CONSENT_VERSION ?? DEFAULT_VERSION;
const councilVersion = process.env.E2E_COE_VERSION ?? DEFAULT_VERSION;
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3333';

const consentText = `Accept CEPEJ consent version ${consentVersion}.`;
const councilText = `Acknowledge Council of Europe treaty disclosures version ${councilVersion}.`;

test.describe('Compliance acknowledgement banner', () => {
  test('records pending acknowledgements for the demo workspace', async ({ page, request }) => {
    await page.goto('/fr/workspace');

    await expect(page.getByText('Compliance acknowledgements required')).toBeVisible();
    await expect(page.getByText(consentText)).toBeVisible();
    await expect(page.getByText(councilText)).toBeVisible();

    const ackResponse = page.waitForResponse((response) =>
      response.url().includes('/compliance/acknowledgements') &&
      response.request().method() === 'POST' &&
      response.status() === 200,
    );

    await page.getByRole('button', { name: 'Record acknowledgement' }).click();
    await ackResponse;

    await expect(page.getByText('Compliance acknowledgements up to date')).toBeVisible();
    await expect(page.getByText(consentText)).not.toBeVisible();
    await expect(page.getByText(councilText)).not.toBeVisible();

    const statusResponse = await request.get(`${apiBaseUrl}/compliance/status`, {
      headers: {
        'x-user-id': userId,
        'x-org-id': orgId,
      },
    });

    expect(statusResponse.ok()).toBeTruthy();
    const payload = await statusResponse.json();
    expect(payload?.acknowledgements?.consent?.acknowledgedVersion).toBe(consentVersion);
    expect(payload?.acknowledgements?.consent?.satisfied).toBe(true);
    expect(payload?.acknowledgements?.councilOfEurope?.acknowledgedVersion).toBe(councilVersion);
    expect(payload?.acknowledgements?.councilOfEurope?.satisfied).toBe(true);
  });
});

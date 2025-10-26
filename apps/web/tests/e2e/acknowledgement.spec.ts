import { expect, test } from '@playwright/test';

const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000000';
const CONSENT_VERSION = process.env.ACK_TEST_CONSENT_VERSION ?? '2024-06-01';
const COE_VERSION = process.env.ACK_TEST_COE_VERSION ?? '2024-05-15';
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3333';

test.describe('compliance acknowledgements', () => {
  test('user records consent and council disclosures', async ({ page, request }) => {
    await page.goto('/en/workspace');

    await expect(page.getByRole('heading', { name: 'Compliance acknowledgements required' })).toBeVisible();
    await expect(page.getByText(`Accept CEPEJ consent version ${CONSENT_VERSION}.`)).toBeVisible();
    await expect(
      page.getByText(`Acknowledge Council of Europe treaty disclosures version ${COE_VERSION}.`),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Record acknowledgement' }).click();

    await expect(page.getByRole('heading', { name: 'Compliance acknowledgements up to date' })).toBeVisible();

    const statusResponse = await request.get(`${apiBase}/compliance/status`, {
      headers: {
        'x-org-id': DEMO_ORG_ID,
        'x-user-id': DEMO_USER_ID,
      },
    });
    expect(statusResponse.ok()).toBeTruthy();
    const payload = await statusResponse.json();
    expect(payload.acknowledgements.consent.satisfied).toBeTruthy();
    expect(payload.acknowledgements.councilOfEurope.satisfied).toBeTruthy();
  });
});

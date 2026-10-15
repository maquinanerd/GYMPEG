import { test, expect } from '@playwright/test';

// Body-measurement tracking (issue #202): pick a site, quick-add a value on the
// progress page, see it as the latest-per-site value, then delete it. The card
// renders even with no training data, so a fresh user is enough.

test('a lifter can log and delete a body measurement on the progress page', async ({
  page,
}) => {
  // Register through the API with a unique X-Forwarded-For so this spec keeps
  // its own per-IP register rate-limit bucket (the suite's parallel signups
  // otherwise exhaust the 5/min budget), mirroring the import specs.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.7' },
    data: {
      displayName: 'Measurement E2E',
      email: `e2e-measure-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  // Measurements live on the Body tab of Progress.
  await page.goto('/progress?tab=body');
  // Scope to the Measurements block (the tab also has Bodyweight).
  const card = page.getByRole('region', { name: 'Measurements' });
  await expect(card.getByRole('heading', { name: 'Measurements' })).toBeVisible();
  await expect(card.getByText(/no measurements yet/i)).toBeVisible();

  // The log sheet opens on Waist; add 82.5 cm.
  await card.getByRole('button', { name: 'Log', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Log a measurement' });
  await expect(sheet.getByText(/no waist measurement yet/i)).toBeVisible();
  await sheet.getByLabel(/value \(cm\)/i).fill('82.5');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();

  // The sheet's history gets a deletable row, and the list the latest value.
  const deleteButton = sheet.getByRole('button', { name: /delete waist measurement/i }).first();
  await expect(deleteButton).toBeVisible();
  await expect(card.getByText('82.5 cm')).toBeVisible();

  // Delete it: back to the empty trend state for waist.
  await deleteButton.click();
  await expect(sheet.getByText(/no waist measurement yet/i)).toBeVisible();
});

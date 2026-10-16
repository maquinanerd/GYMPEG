import { test, expect } from '@playwright/test';

// Dedicated client IP so the UI signup does not share the default register
// rate-limit bucket with other specs (issue #292).
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '10.111.1.2' } });

// Bodyweight tracking (issue #99): quick-add a measurement on the progress
// page, see it listed as the current value, then delete it. The card renders
// even with no training data, so a fresh user is enough.

test('a lifter can log and delete a bodyweight entry on the progress page', async ({
  page,
}) => {
  // Sign up (fresh user each run).
  await page.goto('/signup');
  await page.getByLabel('Name').fill('Bodyweight E2E');
  await page.getByLabel('Email').fill(`e2e-bodyweight-${Date.now()}@test.dev`);
  await page.getByLabel('Password').fill('supersecret');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');

  // The bodyweight block lives on the Body tab of Progress.
  await page.goto('/progress?tab=body');
  // Scope to the Bodyweight block (the tab also has Measurements, whose own
  // "Log" button would otherwise be ambiguous).
  const card = page.getByRole('region', { name: 'Bodyweight' });
  await expect(card.getByText(/no bodyweight logged yet/i)).toBeVisible();

  // Log 82.5 kg from the sheet.
  await card.getByRole('button', { name: 'Log weight' }).click();
  const sheet = page.getByRole('dialog', { name: 'Log bodyweight' });
  await sheet.getByLabel(/bodyweight \(kg\)/i).fill('82.5');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(card.getByText('82.5 kg')).toBeVisible();
  // The entry shows in the sheet's recent list with a delete button.
  await card.getByRole('button', { name: 'Log', exact: true }).click();
  const deleteButton = page
    .getByRole('dialog', { name: 'Log bodyweight' })
    .getByRole('button', { name: /delete entry/i })
    .first();
  await expect(deleteButton).toBeVisible();

  // Delete it again: back to the empty state.
  await deleteButton.click();
  await page.keyboard.press('Escape');
  await expect(card.getByText(/no bodyweight logged yet/i)).toBeVisible();
});

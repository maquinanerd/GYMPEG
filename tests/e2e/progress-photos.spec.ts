import { test, expect } from '@playwright/test';

// Progress photos (issue #269): upload a photo on the progress page and see
// it in the gallery. The card renders even with no training data, so a fresh
// user is enough. The fixture is a real 1x1 PNG generated from base64, so the
// magic-byte sniff on the server accepts it and the browser can render it.

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

test('a lifter can upload a progress photo and see it in the gallery', async ({
  page,
}) => {
  // Register through the API with a unique X-Forwarded-For so this spec keeps
  // its own per-IP register rate-limit bucket (the suite's parallel signups
  // otherwise exhaust the 5/min budget), mirroring the other specs.
  const registerRes = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.10' },
    data: {
      displayName: 'Photos E2E',
      email: `e2e-photos-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(registerRes.ok()).toBeTruthy();

  // Photos live on the Body tab of Progress.
  await page.goto('/progress?tab=body');
  // Scope to the Progress photos block (the tab has several sections).
  const card = page.getByRole('region', { name: 'Progress photos' });
  await expect(card.getByRole('heading', { name: 'Progress photos' })).toBeVisible();
  await expect(card.getByText(/no progress photos yet/i)).toBeVisible();

  // Upload the tiny PNG with a note, from the "Add" sheet.
  await card.getByRole('button', { name: 'Add', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Add a progress photo' });
  await sheet.getByLabel('Photo').setInputFiles({
    name: 'front.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });
  await sheet.getByLabel(/note/i).fill('e2e upload');
  await sheet.getByRole('button', { name: 'Upload', exact: true }).click();

  // The thumbnail appears, served through the ownership-scoped image route.
  const thumbnail = card.locator('img[src*="/api/progress-photos/"]').first();
  await expect(thumbnail).toBeVisible();
  await expect(card.getByText(/no progress photos yet/i)).toBeHidden();

  // Open it and delete it (accepting the confirm dialog): back to empty.
  page.on('dialog', (dialog) => void dialog.accept());
  await card.getByRole('button', { name: /photo of/i }).first().click();
  await page.getByRole('button', { name: /delete photo of/i }).click();
  await expect(card.getByText(/no progress photos yet/i)).toBeVisible();
});

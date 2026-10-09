import { test, expect } from '@playwright/test';

// Each spec file registers through the app's real per-IP rate limit
// (register:<ip>, 5 per 60s). A dedicated client IP per file keeps UI signups
// out of the shared default bucket so back-to-back runs stay green (issue #292).
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '10.111.1.1' } });

// Auth flow does not require an LLM key, only a migrated database.
test('a new user can sign up, log out and sign back in', async ({ page }) => {
  const email = `e2e-${Date.now()}@test.dev`;
  const password = 'supersecret';

  // Sign up
  await page.goto('/signup');
  await page.getByLabel('Name').fill('E2E User');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');

  // Log out (the logout control lives in the app shell)
  await page.getByRole('button', { name: /log ?out|sign ?out/i }).click();
  await expect(page).toHaveURL(/\/login$/);

  // Sign back in
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
});

// The CI server has no e-mail provider: the reset screen says so instead of
// pretending to send a link.
test('the login page leads to password reset, unavailable without e-mail', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot your password?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole('status')).toHaveText(
    'Password reset by e-mail is not set up on this server.',
  );
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/reset-password?token=not-a-real-token');
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel('New password', { exact: true }).fill('brand-new-password');
  await page.getByLabel('Repeat the new password').fill('brand-new-password');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.getByRole('status')).toContainText('This link is invalid');
});

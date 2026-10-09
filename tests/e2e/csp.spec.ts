import { test, expect, type Page } from '@playwright/test';

// Dedicated client IP for the per-IP signup rate limit (issue #292).
test.use({ extraHTTPHeaders: { 'x-forwarded-for': '10.111.1.40' } });

const NONCE_POLICY = /script-src 'self' 'nonce-([A-Za-z0-9+/=]+)' 'strict-dynamic'/;

// Every blocked script, style or connection fires securitypolicyviolation;
// the listener is installed before any page script runs.
async function recordViolations(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
}

async function violations(page: Page): Promise<string[]> {
  return page.evaluate(
    () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
  );
}

test('pages run under a per-request nonce CSP without violations', async ({ page, request }) => {
  const first = await request.get('/login');
  const second = await request.get('/login');
  const firstNonce = first.headers()['content-security-policy']?.match(NONCE_POLICY)?.[1];
  const secondNonce = second.headers()['content-security-policy']?.match(NONCE_POLICY)?.[1];
  expect(firstNonce).toBeTruthy();
  expect(secondNonce).toBeTruthy();
  expect(firstNonce).not.toBe(secondNonce);

  await recordViolations(page);
  await page.goto('/signup');
  await page.getByLabel('Name').fill('CSP User');
  await page.getByLabel('Email').fill(`e2e-csp-${Date.now()}@test.dev`);
  await page.getByLabel('Password').fill('supersecret');
  // Reaching the dashboard needs the hydrated client: scripts were allowed.
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL('/');
  expect(await violations(page)).toEqual([]);

  for (const path of ['/history', '/programs', '/settings', '/session/new']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await violations(page), path).toEqual([]);
  }
});

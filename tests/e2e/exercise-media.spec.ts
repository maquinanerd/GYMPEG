import { test, expect } from '@playwright/test';

// Exercise technique media lives under /public/exercise-media and is rendered
// through next/image, whose optimizer fetches the source file with a
// cookie-less internal request. The auth middleware used to redirect that
// request to /login, so the optimizer received an HTML page and answered 400:
// every technique image was broken (issue #275 upstream). All requests here
// are made WITHOUT a session on purpose, exactly like the optimizer does.
//
// No licensed exercise frames ship yet (docs/EXERCISE_MEDIA_AUDIT.md), so the
// checks use a tiny solid-color probe image we generated ourselves.

const PROBE = '/exercise-media/gympeg/probe.png';

test.describe('exercise technique media', () => {
  test('a media file is served without a session', async ({ request }) => {
    const res = await request.get(PROBE, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^image\/png/);
  });

  test('the next/image optimizer can read media without a session', async ({ request }) => {
    const res = await request.get(`/_next/image?url=${encodeURIComponent(PROBE)}&w=384&q=75`, {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/^image\//);
  });

  test('a missing media file is a 404, never a login redirect', async ({ request }) => {
    const res = await request.get('/exercise-media/gympeg/missing-frame.png', {
      maxRedirects: 0,
    });
    expect(res.status()).toBe(404);
  });

  test('pages still require a session', async ({ request }) => {
    const res = await request.get('/programs', { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    expect(res.headers()['location']).toContain('/login');
  });
});

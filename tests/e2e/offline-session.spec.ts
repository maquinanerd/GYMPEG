import { expect, test, type Page } from '@playwright/test';

// Offline workout (ADR-004, epic 1.4 part 2): with the network cut, a lifter
// starts a workout, logs a set and finishes it. The service worker serves the
// offline page, which runs the session from the device (outbox + training
// pack). Back online, the outbox creates the session with the device id,
// sends the set, then the finish.

async function seedWorkout(page: Page) {
  const exercise = await (
    await page.request.post('/api/exercises', {
      data: { name: 'E2E Offline Squat', muscleGroup: 'QUADS', category: 'COMPOUND' },
    })
  ).json();
  const program = await (
    await page.request.post('/api/programs', { data: { name: 'E2E Offline Block', phase: 'Base' } })
  ).json();
  expect((await page.request.post(`/api/programs/${program.id}/activate`, { data: {} })).ok()).toBe(
    true,
  );
  const workout = await (
    await page.request.post(`/api/programs/${program.id}/workouts`, {
      data: { name: 'Offline day' },
    })
  ).json();
  const prescription = await page.request.post(`/api/workouts/${workout.id}/program-exercises`, {
    data: {
      exerciseId: exercise.id,
      targetSets: 3,
      targetRepsMin: 8,
      targetRepsMax: 12,
      targetRIR: 2,
      restSec: 60,
    },
  });
  expect(prescription.ok()).toBeTruthy();
  return { workoutId: workout.id as string };
}

// True once the training pack is in the device's IndexedDB. Checks that the
// database exists first: opening a missing one would create an empty copy
// under Dexie's feet.
async function packStored(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (!databases.some((entry) => entry.name === 'GymCoachDB')) return false;
    return new Promise<boolean>((resolve) => {
      const request = indexedDB.open('GymCoachDB');
      request.onerror = () => resolve(false);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('trainingPacks')) {
          db.close();
          resolve(false);
          return;
        }
        const count = db.transaction('trainingPacks').objectStore('trainingPacks').count();
        count.onsuccess = () => {
          db.close();
          resolve(count.result > 0);
        };
        count.onerror = () => {
          db.close();
          resolve(false);
        };
      };
    });
  });
}

test('a lifter starts, logs and finishes a workout offline, and it syncs back online', async ({
  page,
  context,
}) => {
  // Offline behaviour lives in the service worker and IndexedDB: surface what
  // the page and the worker report, so a CI failure explains itself.
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      console.log(`[page ${message.type()}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => console.log(`[page error] ${error.message}`));
  page.on('requestfailed', (request) =>
    console.log(
      `[request failed] ${request.method()} ${request.url()} ${request.failure()?.errorText}`,
    ),
  );
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) console.log(`[navigated] ${frame.url()}`);
  });
  const register = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.21' },
    data: {
      displayName: 'Offline E2E',
      email: `e2e-offline-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(register.ok()).toBeTruthy();
  await seedWorkout(page);

  // Online: the service worker installs (precaching the offline page) and the
  // app stores the training pack.
  await page.goto('/session/new');
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, {
    timeout: 60_000,
  });
  await expect.poll(() => packStored(page), { timeout: 30_000 }).toBe(true);

  // Offline: start the workout from the page already on screen.
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Start this session' }).click();
  await expect(page).toHaveURL(/\/session\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-/, {
    timeout: 20_000,
  });
  const sessionId = new URL(page.url()).pathname.split('/').pop()!;
  await expect(page.getByText(/Exercise 1\/1 · E2E Offline Squat/)).toBeVisible({
    timeout: 20_000,
  });

  // Log one set (prefilled from the prescription) and finish.
  await page.getByRole('button', { name: /^confirm set 1$/i }).click();
  await expect(page.getByTestId('rest-remaining')).toBeVisible();
  await page.getByRole('button', { name: /skip/i }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await page.getByRole('button', { name: 'Finish the session' }).click();

  // Still offline: the offline home, with the workout waiting to be sent.
  await expect(page.getByRole('heading', { name: 'No connection' })).toBeVisible();
  await expect(page.getByText(/waiting to be sent/)).toBeVisible();

  // Back online: the outbox delivers the session, its set and the finish.
  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const res = await page.request.get('/api/sessions');
        if (!res.ok()) return null;
        const sessions = (await res.json()) as Array<{
          id: string;
          finishedAt: string | null;
          _count: { sets: number };
        }>;
        const synced = sessions.find((session) => session.id === sessionId);
        return synced ? { finished: synced.finishedAt != null, sets: synced._count.sets } : null;
      },
      { timeout: 30_000 },
    )
    .toEqual({ finished: true, sets: 1 });
});

// Deleting offline (ADR-004 tombstone): a set already on the server is undone
// with the network cut. It disappears at once, stays deleted, and the server
// drops it when the connection comes back.
test('a set deleted offline is removed from the server once back online', async ({
  page,
  context,
}) => {
  const register = await page.request.post('/api/auth/register', {
    headers: { 'x-forwarded-for': '10.111.0.22' },
    data: {
      displayName: 'Offline Delete E2E',
      email: `e2e-offline-delete-${Date.now()}@test.dev`,
      password: 'supersecret',
    },
  });
  expect(register.ok()).toBeTruthy();
  await seedWorkout(page);

  await page.goto('/session/new');
  await page.getByRole('button', { name: 'Start this session' }).click();
  // The started session's id, not /session/new itself.
  await expect(page).toHaveURL(/\/session\/[0-9a-f]{8}-[0-9a-f]{4}-/, { timeout: 20_000 });
  const sessionId = new URL(page.url()).pathname.split('/').pop()!;
  await expect(page.getByText(/Exercise 1\/1 · E2E Offline Squat/)).toBeVisible({
    timeout: 20_000,
  });

  const serverSets = async () => {
    const res = await page.request.get('/api/sessions');
    if (!res.ok()) return null;
    const sessions = (await res.json()) as Array<{ id: string; _count: { sets: number } }>;
    return sessions.find((session) => session.id === sessionId)?._count.sets ?? null;
  };

  for (const number of [1, 2]) {
    await page.getByRole('button', { name: new RegExp(`^confirm set ${number}$`, 'i') }).click();
    await page.getByRole('button', { name: /skip/i }).click();
  }
  await expect.poll(serverSets, { timeout: 30_000 }).toBe(2);

  await context.setOffline(true);
  await page.getByRole('button', { name: 'Undo set 2' }).click();
  await expect(page.getByText('Set deleted.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Undo set 2' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^confirm set 2$/i })).toBeVisible();

  // Back online the outbox delivers the deletion (the page may have moved to
  // the offline screen meanwhile; the outbox runs there too).
  await context.setOffline(false);
  await expect.poll(serverSets, { timeout: 30_000 }).toBe(1);

  // Reopened online, the session shows the one remaining set.
  await page.goto(`/session/${sessionId}`);
  await expect(page.getByRole('button', { name: 'Undo set 1' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Undo set 2' })).toHaveCount(0);
});

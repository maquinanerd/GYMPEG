import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { HISTORY_CSV_HEADERS } from '@/lib/csv';

// CSV history export with cardio columns (issue #144): the export must
// round-trip duration/distance, with the pre-existing column order untouched.

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
const mockUserId = vi.mocked(getCurrentUserId);

import { GET as getCsv } from '@/app/api/history/csv/route';

function actAs(userId: string) {
  mockUserId.mockResolvedValue(userId);
}

async function seedMixedSession() {
  const user = await db.user.create({
    data: { email: 'csv-export@test.dev', passwordHash: 'x' },
  });
  const running = await db.exercise.create({
    data: { userId: user.id, name: 'Running', muscleGroup: 'OTHER', category: 'CARDIO' },
  });
  const bench = await db.exercise.create({
    data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
  });
  const session = await db.session.create({
    data: {
      userId: user.id,
      startedAt: new Date('2026-06-01T10:00:00Z'),
      finishedAt: new Date('2026-06-01T11:00:00Z'),
    },
  });
  await db.set.create({
    data: {
      sessionId: session.id,
      exerciseId: bench.id,
      setNumber: 1,
      weight: 100,
      reps: 5,
    },
  });
  await db.set.create({
    data: {
      sessionId: session.id,
      exerciseId: running.id,
      setNumber: 1,
      weight: 0,
      reps: 1,
      durationSec: 1800,
      distanceM: 5000,
      avgHr: 152,
      maxHr: 181,
    },
  });
  return { user, session };
}

async function exportRows(query = ''): Promise<{ header: string[]; rows: string[][] }> {
  const res = await getCsv(new Request(`http://test.local/api/history/csv${query}`));
  expect(res.status).toBe(200);
  const body = (await res.text()).replace(/^﻿/, '');
  // Numeric-only cells in these fixtures: a plain split is safe.
  const [header, ...rows] = body.split('\n').map((line) => line.split(','));
  if (!header) throw new Error('empty CSV export');
  return { header, rows };
}

beforeEach(() => {
  mockUserId.mockReset();
});

describe('GET /api/history/csv - cardio columns (issue #144)', () => {
  it('appends cardio columns (duration/distance/HR), populated only on cardio rows', async () => {
    const { user } = await seedMixedSession();
    actAs(user.id);

    const { header, rows } = await exportRows();
    expect(header).toEqual([...HISTORY_CSV_HEADERS]);

    const durationIdx = header.indexOf('duration_sec');
    const distanceIdx = header.indexOf('distance_m');
    const avgHrIdx = header.indexOf('avg_hr');
    const maxHrIdx = header.indexOf('max_hr');
    // The four cardio columns are pinned at the end in this order.
    expect(durationIdx).toBe(header.length - 4);
    expect(distanceIdx).toBe(header.length - 3);
    expect(avgHrIdx).toBe(header.length - 2);
    expect(maxHrIdx).toBe(header.length - 1);

    const exerciseIdx = header.indexOf('exercise');
    const strengthRow = rows.find((r) => r[exerciseIdx] === 'Bench');
    const cardioRow = rows.find((r) => r[exerciseIdx] === 'Running');
    expect(strengthRow).toBeDefined();
    expect(cardioRow).toBeDefined();

    // Cardio row: raw storage units, stored row shape (weight 0 / reps 1).
    expect(cardioRow![durationIdx]).toBe('1800');
    expect(cardioRow![distanceIdx]).toBe('5000');
    expect(cardioRow![avgHrIdx]).toBe('152');
    expect(cardioRow![maxHrIdx]).toBe('181');
    expect(cardioRow![header.indexOf('external_load_kg')]).toBe('0');
    expect(cardioRow![header.indexOf('reps')]).toBe('1');

    // Strength row: cardio columns empty, lifting cells unchanged.
    expect(strengthRow![durationIdx]).toBe('');
    expect(strengthRow![distanceIdx]).toBe('');
    expect(strengthRow![avgHrIdx]).toBe('');
    expect(strengthRow![maxHrIdx]).toBe('');
    expect(strengthRow![header.indexOf('external_load_kg')]).toBe('100');
    expect(strengthRow![header.indexOf('reps')]).toBe('5');
    expect(strengthRow![header.indexOf('volume_kg')]).toBe('500');
  });
});

describe('GET /api/history/csv - history filters (epic 1.8)', () => {
  async function seedFilteredHistory() {
    const user = await db.user.create({
      data: { email: 'csv-filters@test.dev', passwordHash: 'x', timezone: 'America/Sao_Paulo' },
    });
    const gym = await db.gym.create({ data: { userId: user.id, name: 'Downtown' } });
    const bench = await db.exercise.create({
      data: { userId: user.id, name: 'Bench', muscleGroup: 'CHEST', category: 'COMPOUND' },
    });
    const squat = await db.exercise.create({
      data: { userId: user.id, name: 'Squat', muscleGroup: 'QUADS', category: 'COMPOUND' },
    });
    // 2026-07-01 01:30 UTC is still June 30 in Sao Paulo (UTC-3).
    const atGym = await db.session.create({
      data: {
        userId: user.id,
        gymId: gym.id,
        startedAt: new Date('2026-07-01T01:30:00Z'),
        finishedAt: new Date('2026-07-01T02:30:00Z'),
      },
    });
    const elsewhere = await db.session.create({
      data: {
        userId: user.id,
        startedAt: new Date('2026-07-10T12:00:00Z'),
        finishedAt: new Date('2026-07-10T13:00:00Z'),
      },
    });
    await db.set.createMany({
      data: [
        { sessionId: atGym.id, exerciseId: bench.id, setNumber: 1, weight: 80, reps: 8 },
        { sessionId: atGym.id, exerciseId: squat.id, setNumber: 1, weight: 100, reps: 5 },
        { sessionId: elsewhere.id, exerciseId: squat.id, setNumber: 1, weight: 110, reps: 5 },
      ],
    });
    return { user, gym, bench, atGym, elsewhere };
  }

  it('narrows sessions by gym and rows by exercise or muscle', async () => {
    const { user, gym, bench, atGym } = await seedFilteredHistory();
    actAs(user.id);

    const byGym = await exportRows(`?gymId=${gym.id}`);
    const sessionIdx = byGym.header.indexOf('session_id');
    const exerciseIdx = byGym.header.indexOf('exercise');
    expect(new Set(byGym.rows.map((r) => r[sessionIdx]))).toEqual(new Set([atGym.id]));
    expect(byGym.rows).toHaveLength(2);

    const byExercise = await exportRows(`?exerciseId=${bench.id}`);
    expect(byExercise.rows.map((r) => r[exerciseIdx])).toEqual(['Bench']);

    const byMuscle = await exportRows('?muscle=QUADS');
    expect(byMuscle.rows.map((r) => r[exerciseIdx])).toEqual(['Squat', 'Squat']);

    // Malformed filters are ignored, never sent to the database.
    const bogus = await exportRows('?muscle=WINGS&gymId=%27%3B');
    expect(bogus.rows).toHaveLength(3);
  });

  it('uses the user time zone for the month and the date column', async () => {
    const { user, atGym, elsewhere } = await seedFilteredHistory();
    actAs(user.id);

    const june = await exportRows('?month=2026-06');
    const sessionIdx = june.header.indexOf('session_id');
    const dateIdx = june.header.indexOf('session_date');
    expect(new Set(june.rows.map((r) => r[sessionIdx]))).toEqual(new Set([atGym.id]));
    expect(june.rows.every((r) => r[dateIdx] === '2026-06-30')).toBe(true);

    const july = await exportRows('?month=2026-07');
    expect(new Set(july.rows.map((r) => r[sessionIdx]))).toEqual(new Set([elsewhere.id]));
  });
});

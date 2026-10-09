import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteLocalDB, getDB, type LocalSession, type StoredTrainingPack } from '@/lib/indexeddb';
import { setOutboxOwner } from '@/lib/outbox-owner';
import {
  markTrainingPackStale,
  PACK_MAX_AGE_MS,
  refreshTrainingPack,
  runnerPropsFromPack,
} from '@/lib/training-pack';
import type { SessionPack } from '@/app/api/session-pack/route';

// The training pack lets the device run a workout without a network: the
// runner props come from it, and it is refreshed from the server while online.

const GENERATED_AT = Date.parse('2026-10-09T08:00:00.000Z');

function pack(overrides: Partial<SessionPack> = {}): SessionPack {
  return {
    generatedAt: new Date(GENERATED_AT).toISOString(),
    program: { id: 'program-1', name: 'Block' },
    unit: 'KG',
    deloadActive: false,
    readiness: { readiness: 2, soreness: null, ageHours: 1 },
    activeGymId: 'gym-home',
    catalog: [],
    gyms: [
      { id: 'gym-home', name: 'Home' },
      { id: 'gym-club', name: 'Club' },
    ],
    workouts: [
      {
        workout: { id: 'workout-1', programId: 'program-1', name: 'Push', exercises: [] },
        lastPerformances: { 'exercise-1': { maxWeight: 80 } },
        returnRecommendations: {},
      },
    ],
    ...overrides,
  } as unknown as SessionPack;
}

function stored(content: SessionPack = pack()): StoredTrainingPack {
  return { ownerId: 'user-1', savedAt: GENERATED_AT, pack: content };
}

function localSession(overrides: Partial<LocalSession> = {}): LocalSession {
  return {
    id: '0199c2f4-5a3b-7c4d-8e5f-6a7b8c9d0e1f',
    ownerId: 'user-1',
    workoutId: 'workout-1',
    gymId: null,
    startedAt: GENERATED_AT + 60_000,
    finishedAt: null,
    notes: null,
    createStatus: 'pending',
    finishStatus: 'none',
    attempts: 0,
    lastError: null,
    ...overrides,
  };
}

describe('runnerPropsFromPack', () => {
  it("builds the runner props from the pack entry of the session's workout", () => {
    const props = runnerPropsFromPack(stored(), localSession(), GENERATED_AT + 60_000)!;

    expect(props.session).toMatchObject({
      id: localSession().id,
      workoutId: 'workout-1',
      programId: 'program-1',
      finishedAt: null,
      sets: [],
    });
    expect(props.session.startedAt).toEqual(new Date(GENERATED_AT + 60_000));
    expect(props.lastPerformances).toEqual({ 'exercise-1': { maxWeight: 80 } });
    expect(props.unit).toBe('KG');
  });

  it('uses the active gym when none was chosen at start, and the chosen one otherwise', () => {
    expect(runnerPropsFromPack(stored(), localSession(), GENERATED_AT)!.session.gym?.id).toBe(
      'gym-home',
    );
    expect(
      runnerPropsFromPack(stored(), localSession({ gymId: 'gym-club' }), GENERATED_AT)!.session
        .gymId,
    ).toBe('gym-club');
  });

  it('keeps ageing the readiness check-in and drops it once out of its window', () => {
    const anHourLater = runnerPropsFromPack(stored(), localSession(), GENERATED_AT + 3_600_000)!;
    expect(anHourLater.readiness?.ageHours).toBeCloseTo(2);

    const daysLater = runnerPropsFromPack(stored(), localSession(), GENERATED_AT + 5 * 86_400_000)!;
    expect(daysLater.readiness).toBeNull();
  });

  it('applies the exercises replaced only for this session, from the pack catalog', () => {
    const withRow = pack({
      catalog: [
        {
          id: 'exercise-incline',
          name: 'Incline press',
          muscleGroup: 'CHEST',
          category: 'COMPOUND',
          usesBodyweight: false,
          defaultRestSec: 120,
          equipmentType: 'DUMBBELL',
        },
      ],
      workouts: [
        {
          workout: {
            id: 'workout-1',
            programId: 'program-1',
            name: 'Push',
            exercises: [
              {
                id: 'pe-1',
                exerciseId: 'exercise-bench',
                exercise: { id: 'exercise-bench', name: 'Bench' },
              },
            ],
          },
          lastPerformances: {},
          returnRecommendations: {},
        },
      ] as unknown as SessionPack['workouts'],
    });

    const props = runnerPropsFromPack(
      stored(withRow),
      localSession({ exerciseSwaps: { 'pe-1': 'exercise-incline' } }),
      GENERATED_AT,
    )!;

    expect(props.session.workout!.exercises[0]).toMatchObject({
      id: 'pe-1',
      exerciseId: 'exercise-incline',
      exercise: { name: 'Incline press', equipmentType: 'DUMBBELL' },
    });
  });

  it('runs the deload week of the program cycle lighter', () => {
    const cycled = pack({
      timeZone: 'UTC',
      workouts: [
        {
          workout: {
            id: 'workout-1',
            programId: 'program-1',
            name: 'Push',
            program: {
              id: 'program-1',
              name: 'Block',
              cycleWeeks: 4,
              cycleDeloadWeek: 4,
              // Week 1 started on Monday 2026-09-14: 2026-10-09 is in week 4.
              cycleAnchor: '2026-09-14T00:00:00.000Z',
            },
            exercises: [{ id: 'pe-1', exerciseId: 'bench', targetSets: 4, targetRIR: 2 }],
          },
          lastPerformances: {},
          returnRecommendations: {},
        },
      ] as unknown as SessionPack['workouts'],
    });

    const props = runnerPropsFromPack(
      stored(cycled),
      localSession({ startedAt: Date.parse('2026-10-09T10:00:00Z') }),
      GENERATED_AT,
    )!;

    expect(props.session.cycleWeek).toBe(4);
    expect(props.deloadActive).toBe(true);
    expect(props.session.workout!.exercises[0]).toMatchObject({ targetSets: 2, targetRIR: 4 });
  });

  it('returns null when the pack does not hold the workout', () => {
    expect(
      runnerPropsFromPack(stored(), localSession({ workoutId: 'workout-new' }), GENERATED_AT),
    ).toBeNull();
  });
});

describe('refreshTrainingPack', () => {
  beforeEach(async () => {
    await deleteLocalDB();
    setOutboxOwner('user-1');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubPackEndpoint(body: unknown = pack()) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it("stores the account's pack and skips the download while it is fresh", async () => {
    const fetchMock = stubPackEndpoint();

    await refreshTrainingPack();
    await refreshTrainingPack();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const saved = await getDB().trainingPacks.get('user-1');
    expect(saved?.pack.program?.name).toBe('Block');
    expect(Date.now() - saved!.savedAt).toBeLessThan(PACK_MAX_AGE_MS);
  });

  it('downloads again once a finished workout marked it stale', async () => {
    const fetchMock = stubPackEndpoint();
    await refreshTrainingPack();

    await markTrainingPackStale();
    await refreshTrainingPack();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the stored pack when the server cannot be reached', async () => {
    await getDB().trainingPacks.put(stored());
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    await refreshTrainingPack({ force: true });

    expect((await getDB().trainingPacks.get('user-1'))?.savedAt).toBe(GENERATED_AT);
  });

  it('does nothing while no account is known on the device', async () => {
    setOutboxOwner(null);
    const fetchMock = stubPackEndpoint();

    await refreshTrainingPack({ force: true });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

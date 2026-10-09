import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import type { MuscleGroup } from '@/lib/prisma-client';
import { db } from '@/lib/db';
import { getCurrentUserId } from '@/lib/auth';
import { AI_CONSENT_VERSION } from '@/lib/ai/features';
import type { AiWorkoutPlan } from '@/lib/ai/workout-plan';

// Auth is read through getCurrentUserId (via requireApiUserId in @/lib/api).
vi.mock('@/lib/auth', () => ({ getCurrentUserId: vi.fn() }));
// No request scope in a test: the locale comes from here.
vi.mock('next-intl/server', () => ({ getLocale: vi.fn(async () => 'pt-BR') }));
const mockUserId = vi.mocked(getCurrentUserId);

import { POST as generate } from '@/app/api/ai/workout-plan/route';
import { POST as confirm } from '@/app/api/ai/workout-plan/confirm/route';
import {
  DELETE as withdrawConsent,
  GET as readConsent,
  POST as acceptConsent,
} from '@/app/api/ai/consent/route';

// The deterministic demo provider plays the model, so the whole
// generate -> validate -> preview -> confirm path runs without a key.
const saved = {
  provider: process.env.LLM_PROVIDER,
  aiProvider: process.env.AI_PROVIDER,
  disabled: process.env.AI_FEATURES_DISABLED,
};
beforeAll(() => {
  process.env.LLM_PROVIDER = 'demo';
  delete process.env.AI_PROVIDER;
});
afterAll(() => {
  for (const [key, value] of [
    ['LLM_PROVIDER', saved.provider],
    ['AI_PROVIDER', saved.aiProvider],
    ['AI_FEATURES_DISABLED', saved.disabled],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

const actAs = (userId: string) => mockUserId.mockResolvedValue(userId);

function jsonReq(body: unknown, method = 'POST'): Request {
  return new Request('http://test.local/api/ai', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const CATALOG: [string, MuscleGroup, 'COMPOUND' | 'ISOLATION'][] = [
  ['Agachamento livre', 'QUADS', 'COMPOUND'],
  ['Leg press', 'QUADS', 'COMPOUND'],
  ['Supino reto', 'CHEST', 'COMPOUND'],
  ['Supino inclinado', 'CHEST', 'COMPOUND'],
  ['Remada curvada', 'BACK_THICKNESS', 'COMPOUND'],
  ['Puxada frontal', 'BACK_WIDTH', 'COMPOUND'],
  ['Stiff', 'HAMSTRINGS', 'COMPOUND'],
  ['Elevação pélvica', 'GLUTES', 'COMPOUND'],
  ['Desenvolvimento', 'SHOULDERS_FRONT', 'COMPOUND'],
  ['Elevação lateral', 'SHOULDERS_LATERAL', 'ISOLATION'],
  ['Rosca direta', 'BICEPS', 'ISOLATION'],
  ['Tríceps na polia', 'TRICEPS', 'ISOLATION'],
];

async function seedCatalog() {
  for (const [name, muscleGroup, category] of CATALOG) {
    await db.exercise.create({ data: { name, muscleGroup, category } });
  }
}

async function makeUser(email: string, consented = true) {
  return db.user.create({
    data: {
      email,
      passwordHash: 'x',
      weeklyFrequency: 3,
      sessionMinutes: 60,
      trainingDays: [1, 3, 5],
      ...(consented ? { aiConsentAt: new Date(), aiConsentVersion: AI_CONSENT_VERSION } : {}),
    },
  });
}

interface GenerateBody {
  plan: AiWorkoutPlan;
  warnings: { code: string }[];
  analysis: { estimatedMinutes: number[]; missingMajorGroups: string[] };
  exercises: Record<string, { name: string }>;
  promptVersion: string;
}

beforeEach(async () => {
  mockUserId.mockReset();
  delete process.env.AI_FEATURES_DISABLED;
  await seedCatalog();
});

describe('AI consent', () => {
  it('is required before a plan is generated, and can be accepted and withdrawn', async () => {
    const user = await makeUser('ai-consent@test.dev', false);
    actAs(user.id);

    const blocked = await generate(jsonReq({ request: '' }));
    expect(blocked.status).toBe(403);
    expect(((await blocked.json()) as { error: string }).error).toBe('AI_CONSENT_REQUIRED');
    // Nothing reached a provider.
    expect(await db.aIUsage.count({ where: { userId: user.id } })).toBe(0);

    // An outdated notice cannot be accepted.
    expect((await acceptConsent(jsonReq({ version: '2000-01-01' }))).status).toBe(400);
    const accepted = await acceptConsent(jsonReq({ version: AI_CONSENT_VERSION }));
    expect(accepted.status).toBe(200);
    expect(((await (await readConsent()).json()) as { consented: boolean }).consented).toBe(true);
    expect((await generate(jsonReq({ request: '' }))).status).toBe(200);

    await withdrawConsent();
    const stored = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.aiConsentAt).toBeNull();
    expect((await generate(jsonReq({ request: '' }))).status).toBe(403);
  });

  it('is refused when the instance turns the feature off', async () => {
    const user = await makeUser('ai-disabled@test.dev');
    actAs(user.id);
    process.env.AI_FEATURES_DISABLED = 'ai.chat, ai.workout_generation';
    const res = await generate(jsonReq({ request: '' }));
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: string }).error).toBe('AI_FEATURE_DISABLED');
  });
});

describe('POST /api/ai/workout-plan', () => {
  it('returns a validated plan made only of exercises the lifter can use, and logs the call', async () => {
    const user = await makeUser('ai-plan@test.dev');
    const stranger = await makeUser('ai-plan-stranger@test.dev');
    // A stranger's custom exercise must never be offered.
    const foreign = await db.exercise.create({
      data: {
        userId: stranger.id,
        name: 'Aaa stranger squat',
        muscleGroup: 'QUADS',
        category: 'COMPOUND',
      },
    });
    actAs(user.id);

    const res = await generate(jsonReq({ request: 'Hipertrofia, 3 dias' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as GenerateBody;
    expect(body.plan.workouts).toHaveLength(3);
    expect(body.plan.workouts.map((w) => w.dayOfWeek)).toEqual([1, 3, 5]);
    expect(body.analysis.missingMajorGroups).toEqual([]);
    expect(body.promptVersion).toBe('workout-planner/v1');

    const catalogIds = new Set(
      (await db.exercise.findMany({ where: { userId: null } })).map((e) => e.id),
    );
    const usedIds = body.plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId));
    expect(usedIds.every((id) => catalogIds.has(id))).toBe(true);
    expect(usedIds).not.toContain(foreign.id);
    expect(Object.keys(body.exercises).sort()).toEqual([...new Set(usedIds)].sort());

    const usage = await db.aIUsage.findMany({ where: { userId: user.id } });
    expect(usage).toHaveLength(1);
    expect(usage[0]).toMatchObject({
      provider: 'demo',
      operation: 'GENERATE_PROGRAM',
      success: true,
      promptVersion: 'workout-planner/v1',
    });
    // Nothing was saved as a program yet.
    expect(await db.program.count({ where: { userId: user.id } })).toBe(0);
  });

  it('answers a retried request with the same result and a single provider call', async () => {
    const user = await makeUser('ai-plan-idem@test.dev');
    actAs(user.id);
    const idempotencyKey = '6f1f8a52-2c5d-4b55-9a7e-0d6c1f0e3a11';

    const first = (await (
      await generate(jsonReq({ request: '', idempotencyKey }))
    ).json()) as GenerateBody;
    const second = (await (
      await generate(jsonReq({ request: '', idempotencyKey }))
    ).json()) as GenerateBody;
    expect(second).toEqual(first);
    expect(await db.aIUsage.count({ where: { userId: user.id } })).toBe(1);
  });

  it('respects the exercises the lifter avoids', async () => {
    const user = await makeUser('ai-plan-avoid@test.dev');
    const squat = await db.exercise.findFirstOrThrow({ where: { name: 'Agachamento livre' } });
    await db.exercisePreference.create({
      data: { userId: user.id, exerciseId: squat.id, kind: 'AVOID' },
    });
    actAs(user.id);
    const body = (await (await generate(jsonReq({ request: '' }))).json()) as GenerateBody;
    const usedIds = body.plan.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId));
    expect(usedIds).not.toContain(squat.id);
  });
});

describe('POST /api/ai/workout-plan/confirm', () => {
  it('saves the previewed plan as a program with an AI_GENERATED version and can activate it', async () => {
    const user = await makeUser('ai-confirm@test.dev');
    actAs(user.id);
    const old = await db.program.create({
      data: { userId: user.id, name: 'Old', phase: 'Base', isActive: true },
    });
    const { plan } = (await (await generate(jsonReq({ request: '' }))).json()) as GenerateBody;

    const res = await confirm(jsonReq({ plan, activate: true }));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };

    const program = await db.program.findUniqueOrThrow({
      where: { id },
      include: { workouts: { include: { exercises: true }, orderBy: { order: 'asc' } } },
    });
    expect(program.userId).toBe(user.id);
    expect(program.isActive).toBe(true);
    expect(program.scheduleMode).toBe('FIXED_DAYS');
    expect(program.workouts).toHaveLength(plan.workouts.length);
    expect(program.workouts[0]!.exercises).toHaveLength(plan.workouts[0]!.exercises.length);
    expect(program.workouts[0]!.exercises[0]).toMatchObject({
      exerciseId: plan.workouts[0]!.exercises[0]!.exerciseId,
      targetSets: plan.workouts[0]!.exercises[0]!.sets,
      targetRIR: 2,
    });
    const revisions = await db.programRevision.findMany({ where: { programId: id } });
    expect(revisions.map((r) => r.source)).toEqual(['AI_GENERATED']);
    expect((await db.program.findUniqueOrThrow({ where: { id: old.id } })).isActive).toBe(false);
  });

  it("rejects a plan that names another user's custom exercise", async () => {
    const user = await makeUser('ai-confirm-owner@test.dev');
    const stranger = await makeUser('ai-confirm-stranger@test.dev');
    const foreign = await db.exercise.create({
      data: {
        userId: stranger.id,
        name: 'Private press',
        muscleGroup: 'CHEST',
        category: 'COMPOUND',
      },
    });
    actAs(user.id);
    const { plan } = (await (await generate(jsonReq({ request: '' }))).json()) as GenerateBody;
    plan.workouts[0]!.exercises[0]!.exerciseId = foreign.id;

    const res = await confirm(jsonReq({ plan }));
    expect(res.status).toBe(400);
    expect(await db.program.count({ where: { userId: user.id } })).toBe(0);
  });

  it('rejects values outside the domain limits even when edited by hand', async () => {
    const user = await makeUser('ai-confirm-limits@test.dev');
    actAs(user.id);
    const { plan } = (await (await generate(jsonReq({ request: '' }))).json()) as GenerateBody;
    plan.workouts[0]!.exercises[0]!.sets = 40;

    const res = await confirm(jsonReq({ plan }));
    expect(res.status).toBe(400);
    expect(await db.program.count({ where: { userId: user.id } })).toBe(0);
  });
});

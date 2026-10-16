import { describe, it, expect } from 'vitest';
import type { CoachPayload } from '@/lib/coach';
import { buildChatSystemPrompt, CHAT_SYSTEM_PROMPT } from './chat-system-prompt';

// Issue #111: the in-session context guidance is INPUT-side only. The chat
// stays free-form text; it must never grow a structured output contract.

describe('chat system prompt', () => {
  it('tells the coach how to use the live currentSession section', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/currentSession/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/mid-workout/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/immediately actionable/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/staying within the user's program/i);
  });

  // The chat has no write path: a trainee asked the coach to add a cardio
  // session and the model answered as if it had done it. The prompt must say
  // the coach cannot change saved data and must never claim it did.
  it('states the coach is advisory only and must never claim to have changed data', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/advisory only/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/cannot create, change, activate or delete programs/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/never say or imply that you added/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Programs page/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/MCP connector/);
    // The Settings toggle is "Allow changes to saved data": the prompt names
    // the capability (write access), not a label that no longer exists.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/MCP connector in Settings with write access enabled/);
    expect(CHAT_SYSTEM_PROMPT).not.toMatch(/program changes allowed/i);
    // ...but a mid-workout deviation stays plain advice: the pointer to the
    // Programs page is scoped to LASTING changes, so the in-session guidance
    // above ("reorder or skip an exercise") is not contradicted.
    expect(CHAT_SYSTEM_PROMPT).toMatch(/one-off deviation for today's session/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/lasting change to their saved program/i);
  });

  // The coach answered "que ia você é?" with a canned English reply and used to
  // call itself GymCoach (the upstream name). It must present itself as GYM
  // Peg's AI coach and ground science on the curated knowledge cards.
  it('presents itself as GYM Peg and grounds science on the knowledge cards', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/AI coach of GYM Peg/);
    expect(CHAT_SYSTEM_PROMPT).not.toMatch(/GymCoach/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/About this assistant/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Knowledge cards/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/never recompute or invent it/i);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/trainingHistory/);
  });

  it('defines no structured output contract (free-form text only)', () => {
    expect(CHAT_SYSTEM_PROMPT).not.toContain('<adjustments>');
    expect(CHAT_SYSTEM_PROMPT).not.toMatch(/JSON object/i);
  });
});

// The request layout is built for the provider's prompt cache: whatever is the
// same across the turns of a conversation must come first and be byte-for-byte
// identical, so only the question-specific knowledge cards are re-billed.
describe('buildChatSystemPrompt', () => {
  function payload(overrides: Partial<CoachPayload> = {}): CoachPayload {
    return {
      generatedAt: '2026-10-15T21:40:00.000Z',
      userProfile: {
        displayName: 'Pablo',
        sex: null,
        heightCm: null,
        bodyweight: 80,
        goal: null,
        weeklyFrequency: 5,
        coachNote: null,
      },
      weekCurrent: { weekStart: '2026-10-12T03:00:00.000Z', sessions: [] },
      weekPrevious: null,
      activeProgram: null,
      latestReadiness: null,
      goals: [],
      fatigue: {
        stalledExercises: [],
        deloadRecommended: false,
        deloadReasons: [],
        deloadActive: false,
      },
      conditioning: {
        weekCurrent: { minutes: 0, km: 0, sessions: 0 },
        weekPrevious: null,
        days: [],
        weeklyTargetMin: 150,
      },
      records: [],
      recentProgress: [],
      ...overrides,
    };
  }

  const build = (p: CoachPayload, knowledgeSection: string) =>
    buildChatSystemPrompt({
      model: 'DeepSeek (deepseek-flash)',
      today: '2026-10-15',
      payload: p,
      knowledgeSection,
    });

  it('puts the stable prompt first, then the data, then the knowledge cards', () => {
    const system = build(payload(), '# Knowledge cards\ncard text');
    expect(system.startsWith(CHAT_SYSTEM_PROMPT)).toBe(true);
    expect(system).toContain('Model: DeepSeek (deepseek-flash). Today is 2026-10-15');
    const data = system.indexOf("# Trainee's current training data");
    const knowledge = system.indexOf('# Knowledge cards');
    expect(data).toBeGreaterThan(0);
    expect(knowledge).toBeGreaterThan(data);
    expect(system.endsWith('card text')).toBe(true);
  });

  it('sends compact JSON without the per-request timestamp', () => {
    const system = build(payload(), 'k');
    expect(system).not.toContain('generatedAt');
    expect(system).not.toContain('2026-10-15T21:40');
    expect(system).toContain('{"userProfile":{"displayName":"Pablo"');
    expect(system).not.toMatch(/\n {2}"/);
  });

  it('keeps the prefix identical across questions and requests', () => {
    const a = build(payload(), '# Knowledge cards\nvolume');
    const b = build(
      payload({ generatedAt: '2026-10-15T21:45:00.000Z' }),
      '# Knowledge cards\nrest',
    );
    const prefix = a.slice(0, a.indexOf('# Knowledge cards'));
    expect(prefix.length).toBeGreaterThan(CHAT_SYSTEM_PROMPT.length);
    expect(b.startsWith(prefix)).toBe(true);
  });

  it('serializes the live session last, after the slower-moving data', () => {
    const p = payload({
      currentSession: {
        workoutName: 'Push A',
        startedAt: '2026-10-15T21:00:00.000Z',
        exercises: [],
        readinessToday: null,
      },
    });
    p.trainingHistory = {
      totalSessions: 1,
      firstSessionDate: null,
      lastSessionDate: null,
      weeklyTrainedDays: [],
      programs: [],
      recentSessions: [],
    };
    const system = build(p, 'k');
    expect(system.indexOf('"currentSession"')).toBeGreaterThan(system.indexOf('"trainingHistory"'));
    // The in-session demo branch keys on the quoted name.
    expect(system).toContain('"currentSession":');
  });
});

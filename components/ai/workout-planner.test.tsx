import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { WorkoutPlanner } from './workout-planner';

const RESULT = {
  plan: {
    title: 'Full body 2x',
    rationale: 'Two full-body sessions.',
    daysPerWeek: 2,
    workouts: [
      {
        name: 'Full body A',
        dayOfWeek: 1,
        estimatedDurationMinutes: 40,
        exercises: [
          {
            exerciseId: 'squat',
            order: 1,
            sets: 3,
            repMin: 6,
            repMax: 10,
            targetRir: 2,
            targetRpe: null,
            restSeconds: 150,
          },
          {
            exerciseId: 'bench',
            order: 2,
            sets: 3,
            repMin: 6,
            repMax: 10,
            targetRir: 2,
            targetRpe: null,
            restSeconds: 150,
          },
          {
            exerciseId: 'row',
            order: 3,
            sets: 3,
            repMin: 6,
            repMax: 10,
            targetRir: 2,
            targetRpe: null,
            restSeconds: 150,
          },
          {
            exerciseId: 'rdl',
            order: 4,
            sets: 3,
            repMin: 6,
            repMax: 10,
            targetRir: 2,
            targetRpe: null,
            restSeconds: 150,
          },
          {
            exerciseId: 'ohp',
            order: 5,
            sets: 3,
            repMin: 6,
            repMax: 10,
            targetRir: 2,
            targetRpe: null,
            restSeconds: 150,
          },
        ],
      },
      {
        name: 'Full body B',
        dayOfWeek: 4,
        estimatedDurationMinutes: 40,
        exercises: [
          {
            exerciseId: 'squat',
            order: 1,
            sets: 3,
            repMin: 6,
            repMax: 10,
            targetRir: 2,
            targetRpe: null,
            restSeconds: 150,
          },
          {
            exerciseId: 'bench',
            order: 2,
            sets: 3,
            repMin: 6,
            repMax: 10,
            targetRir: 2,
            targetRpe: null,
            restSeconds: 150,
          },
        ],
      },
    ],
  },
  exercises: {
    squat: { name: 'Back squat', primaryMuscles: ['QUADS'] },
    bench: { name: 'Bench press', primaryMuscles: ['CHEST'] },
    row: { name: 'Barbell row', primaryMuscles: ['BACK_THICKNESS'] },
    rdl: { name: 'Romanian deadlift', primaryMuscles: ['HAMSTRINGS'] },
    ohp: { name: 'Overhead press', primaryMuscles: ['SHOULDERS_FRONT'] },
  },
  availability: { sessionsPerWeek: 2, sessionMinutes: 60 },
  warnings: [],
  analysis: { estimatedMinutes: [], weeklySetsByMuscle: {}, missingMajorGroups: [] },
  promptVersion: 'workout-planner/v1',
};

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('WorkoutPlanner', () => {
  it('asks for consent first and sends the version shown', async () => {
    const fetchMock = stubFetch(() => json({ consented: true }));
    const user = userEvent.setup();
    render(<WorkoutPlanner initialConsent={false} consentVersion="2026-10-09" enabled />);

    expect(screen.queryByRole('button', { name: 'Generate plan' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'I agree' }));

    await screen.findByRole('button', { name: 'Generate plan' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/consent',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ version: '2026-10-09' }) }),
    );
  });

  it('shows that the feature is off on this server', () => {
    render(<WorkoutPlanner initialConsent consentVersion="v" enabled={false} />);
    expect(screen.getByText('AI planning is turned off on this server.')).toBeInTheDocument();
  });

  it('previews the plan, re-validates after an edit and saves the edited plan', async () => {
    const fetchMock = stubFetch((url) =>
      url === '/api/ai/workout-plan' ? json(RESULT) : json({ id: 'program-1' }, 201),
    );
    const user = userEvent.setup();
    render(<WorkoutPlanner initialConsent consentVersion="v" enabled />);

    await user.type(screen.getByLabelText('Anything specific? (optional)'), 'Full body');
    await user.click(screen.getByRole('button', { name: 'Generate plan' }));

    expect(await screen.findByText('Full body 2x')).toBeInTheDocument();
    expect(screen.getAllByText('Back squat')).toHaveLength(2);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Quads: 6')).toBeInTheDocument();
    const generateBody = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)) as {
      request: string;
      idempotencyKey: string;
    };
    expect(generateBody.request).toBe('Full body');
    expect(generateBody.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);

    // Removing the only press of workout A: shoulders lose their direct work.
    const removeButtons = screen.getAllByRole('button', { name: 'Remove exercise' });
    await user.click(removeButtons[4]!);
    expect(screen.queryByText('Overhead press')).not.toBeInTheDocument();
    expect(screen.getByText('No direct work for shoulders.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save and activate' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/programs/program-1'));
    const saveBody = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body)) as {
      plan: typeof RESULT.plan;
      activate: boolean;
    };
    expect(saveBody.activate).toBe(true);
    expect(saveBody.plan.workouts[0]!.exercises.map((e) => e.exerciseId)).toEqual([
      'squat',
      'bench',
      'row',
      'rdl',
    ]);
  });

  it('falls back to the consent card when the server says consent is missing', async () => {
    stubFetch(() => json({ error: 'AI_CONSENT_REQUIRED' }, 403));
    const user = userEvent.setup();
    render(<WorkoutPlanner initialConsent consentVersion="v" enabled />);
    await user.click(screen.getByRole('button', { name: 'Generate plan' }));
    expect(await screen.findByRole('button', { name: 'I agree' })).toBeInTheDocument();
  });
});

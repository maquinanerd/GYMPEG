import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingFlow, type OnboardingInitial } from './onboarding-flow';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/shared/use-exercise-name', () => ({
  useExerciseName: () => (name: string) => name,
}));

const initial: OnboardingInitial = {
  goal: null,
  experience: null,
  daysPerWeek: null,
  trainingDays: [],
  sessionMinutes: null,
  preferredTrainingTime: null,
  gymName: null,
  availableEquipment: [],
  priorityMuscles: [],
  avoidExerciseIds: [],
  bodyweightKg: null,
  heightCm: null,
  birthDate: null,
  sex: null,
  unit: 'KG',
};

const exercises = [
  { id: 'ex-press', name: 'Leg press 45 degrees' },
  { id: 'ex-bench', name: 'Barbell bench press' },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('OnboardingFlow', () => {
  it('needs a goal before moving on', async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow initial={initial} exercises={exercises} />);

    const next = screen.getByRole('button', { name: 'Next' });
    expect(next).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Hypertrophy' }));
    expect(next).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hypertrophy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('walks every step and posts the answers', async () => {
    const fetchFn = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response('{"ok":true}', { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchFn);
    const user = userEvent.setup();
    render(<OnboardingFlow initial={initial} exercises={exercises} />);

    await user.click(screen.getByRole('button', { name: 'Strength' }));
    await user.click(screen.getByRole('button', { name: /Intermediate/ }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Mon' }));
    await user.click(screen.getByRole('button', { name: 'Thu' }));
    await user.click(screen.getByRole('button', { name: '60 min' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.type(screen.getByLabelText('Gym name'), 'Academia A');
    // Preselected typical gym: untick the smith machine.
    await user.click(screen.getByRole('button', { name: 'Smith machine' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.click(screen.getByRole('button', { name: 'Chest' }));
    await user.type(screen.getByLabelText('Exercises to avoid (optional)'), 'leg press');
    await user.click(screen.getByRole('button', { name: 'Leg press 45 degrees' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    await user.type(screen.getByLabelText('Bodyweight (kg)'), '82,5');
    await user.click(screen.getByRole('button', { name: 'Save and finish' }));

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/onboarding',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchFn.mock.calls[0]![1]!.body as string);
    expect(body).toMatchObject({
      goal: 'STRENGTH',
      experience: 'INTERMEDIATE',
      daysPerWeek: 4,
      trainingDays: [1, 4],
      sessionMinutes: 60,
      gym: { name: 'Academia A' },
      priorityMuscles: ['CHEST'],
      avoidExerciseIds: ['ex-press'],
      bodyweight: 82.5,
      unit: 'KG',
    });
    expect(body.gym.availableEquipment).not.toContain('smith_machine');
    expect(body.gym.availableEquipment).toContain('barbell');
    expect(replace).toHaveBeenCalledWith('/');
  });

  it('can be skipped', async () => {
    const fetchFn = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}'));
    vi.stubGlobal('fetch', fetchFn);
    const user = userEvent.setup();
    render(<OnboardingFlow initial={initial} exercises={exercises} />);

    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(fetchFn).toHaveBeenCalledWith('/api/onboarding', { method: 'DELETE' });
    expect(replace).toHaveBeenCalledWith('/');
  });
});

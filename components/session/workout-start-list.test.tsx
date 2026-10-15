import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const lifecycle = vi.hoisted(() => ({
  startSession: vi.fn(async () => ({ id: 's1', synced: true })),
}));
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/session-lifecycle', () => ({ startSession: lifecycle.startSession }));

import { WorkoutStartList } from './workout-start-list';

const workouts = [
  { id: 'w1', name: 'Upper A', day: 'Monday', exerciseCount: 5 },
  { id: 'w2', name: 'Lower A', day: null, exerciseCount: 4 },
  { id: 'w3', name: 'Empty day', day: null, exerciseCount: 0 },
];

describe('WorkoutStartList', () => {
  it('lists the workouts as rows with their meta and a start button each', () => {
    render(<WorkoutStartList workouts={workouts} gyms={[]} activeGymId={null} suggestedId="w2" />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('5 exercises · Monday');
    // The name of each workout describes its button.
    const start = within(rows[0]!).getByRole('button', { name: 'Start this session' });
    expect(start).toHaveAccessibleDescription('Upper A');
    expect(start).toHaveClass('border-input');
  });

  it('marks the suggested workout with the tag and the ink button', () => {
    render(<WorkoutStartList workouts={workouts} gyms={[]} activeGymId={null} suggestedId="w2" />);
    const suggested = screen.getAllByRole('listitem')[1]!;
    expect(suggested).toHaveAttribute('data-suggested', 'true');
    expect(within(suggested).getByText('Suggested')).toBeInTheDocument();
    expect(within(suggested).getByRole('button', { name: 'Start this session' })).toHaveClass(
      'bg-ink',
    );
  });

  it('cannot start a workout without exercises', () => {
    render(<WorkoutStartList workouts={workouts} gyms={[]} activeGymId={null} />);
    const empty = screen.getAllByRole('listitem')[2]!;
    expect(within(empty).getByRole('button', { name: 'Start this session' })).toBeDisabled();
  });

  it('starts the workout at the chosen gym and opens it', async () => {
    const user = userEvent.setup();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    render(
      <WorkoutStartList
        workouts={workouts}
        gyms={[{ id: 'g1', name: 'Home gym' }]}
        activeGymId="g1"
      />,
    );
    expect(screen.getByLabelText('Gym for this session')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Start this session' })[0]!);
    expect(lifecycle.startSession).toHaveBeenCalledWith({ workoutId: 'w1', gymId: 'g1' });
    expect(router.push).toHaveBeenCalledWith('/session/s1');
  });
});

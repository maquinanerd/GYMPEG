import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SessionExerciseStrip } from './session-exercise-strip';

vi.mock('@/components/shared/use-exercise-name', () => ({
  useExerciseName: () => (name: string) => name,
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const exercises = [
  {
    id: 'pe-1',
    exerciseId: 'exercise-1',
    supersetGroup: 1,
    exercise: { id: 'exercise-1', name: 'Squats · Barbell' },
  },
  {
    id: 'pe-2',
    exerciseId: 'exercise-2',
    supersetGroup: 1,
    exercise: { id: 'exercise-2', name: 'Custom Rear Delt Raise' },
  },
  {
    id: 'pe-3',
    exerciseId: 'exercise-3',
    supersetGroup: null,
    exercise: { id: 'exercise-3', name: 'Standing Calf Raise' },
  },
] as never;

describe('SessionExerciseStrip', () => {
  it('shows the completion state, highlights the current chip and selects an exercise', () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    render(
      <SessionExerciseStrip
        exercises={exercises}
        currentIndex={0}
        completedProgramExerciseIds={new Set(['pe-1'])}
        onSelect={onSelect}
        onOpen={onOpen}
      />,
    );

    expect(screen.getByRole('group', { name: 'Workout exercises' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1. Squats · Barbell · Completed' })).toHaveAttribute(
      'aria-current',
      'step',
    );

    const active = screen.getByRole('button', { name: '1. Squats · Barbell · Completed' });
    const inactive = screen.getByRole('button', { name: '2. Custom Rear Delt Raise' });
    // The current exercise is the lime chip, the others sit on the pill fill.
    expect(active).toHaveClass('bg-primary', 'h-12');
    expect(inactive).toHaveClass('bg-pill', 'h-12');

    fireEvent.click(inactive);
    expect(onSelect).toHaveBeenCalledWith(1);
    fireEvent.click(active);
    expect(onOpen).toHaveBeenCalledWith(0);
  });

  it('ignores every tap while disabled, including the current tile', () => {
    const onSelect = vi.fn();
    const onOpen = vi.fn();
    render(
      <SessionExerciseStrip
        exercises={exercises}
        currentIndex={0}
        completedProgramExerciseIds={new Set()}
        onSelect={onSelect}
        onOpen={onOpen}
        disabled
      />,
    );

    const active = screen.getByRole('button', { name: '1. Squats · Barbell' });
    const inactive = screen.getByRole('button', { name: '2. Custom Rear Delt Raise' });
    expect(active).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(active);
    fireEvent.click(inactive);
    expect(onOpen).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('marks completion per program row, so a repeated exercise is tracked separately', () => {
    const repeated = [
      ...(exercises as unknown as Array<Record<string, unknown>>),
      {
        id: 'pe-4',
        exerciseId: 'exercise-1',
        supersetGroup: null,
        exercise: { id: 'exercise-1', name: 'Squats · Barbell' },
      },
    ] as never;
    render(
      <SessionExerciseStrip
        exercises={repeated}
        currentIndex={0}
        completedProgramExerciseIds={new Set(['pe-1'])}
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: '1. Squats · Barbell · Completed' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4. Squats · Barbell' })).toBeInTheDocument();
  });

  it('labels superset members A1/A2 and leaves standalone exercises numbered', () => {
    render(
      <SessionExerciseStrip
        exercises={exercises}
        currentIndex={0}
        completedProgramExerciseIds={new Set()}
        supersetLabels={
          new Map([
            ['pe-1', 'A1'],
            ['pe-2', 'A2'],
          ])
        }
        onSelect={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    const first = screen.getByRole('button', { name: '1. Squats · Barbell' });
    const second = screen.getByRole('button', { name: '2. Custom Rear Delt Raise' });
    const standalone = screen.getByRole('button', { name: '3. Standing Calf Raise' });

    expect(first).toHaveTextContent('A1');
    expect(first).toHaveAttribute('data-superset-group', '1');
    expect(second).toHaveTextContent('A2');
    expect(second).toHaveAttribute('data-superset-group', '1');
    expect(standalone).toHaveTextContent(/^3/);
    expect(standalone).not.toHaveAttribute('data-superset-group');
  });
});

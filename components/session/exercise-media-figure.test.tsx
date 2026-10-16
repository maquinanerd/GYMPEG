import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExerciseMediaFigure } from './exercise-media-figure';

// Production serves no media until a licensed source is approved; cover the
// media branch with a fixture instead of the real catalog.
vi.mock(
  '@/lib/exercise-media',
  async () => (await import('@/tests/fixtures/exercise-media-mock')).exerciseMediaMock,
);

afterEach(() => {
  vi.useRealTimers();
});

function renderFigure(name = 'Barbell bench press') {
  return render(
    <ExerciseMediaFigure
      exerciseName={name}
      displayName={name}
      equipmentType="BARBELL"
      muscleGroup="CHEST"
    />,
  );
}

describe('ExerciseMediaFigure', () => {
  it('alternates the start and end frames every 1.5 s until paused', () => {
    vi.useFakeTimers();
    renderFigure();

    expect(screen.getByText('Start')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText('Finish')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pause animation' }));
    act(() => {
      vi.advanceTimersByTime(4500);
    });
    expect(screen.getByText('Finish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play animation' })).toBeInTheDocument();
  });

  it('starts paused when the lifter prefers reduced motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce') }));
    renderFigure();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play animation' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('enlarges into the full-screen viewer with both frames as thumbnails', () => {
    renderFigure();
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge the technique' }));

    const viewer = screen.getByRole('dialog');
    expect(within(viewer).getByText('Start and end of the movement')).toBeInTheDocument();
    expect(within(viewer).getByRole('button', { name: 'Show finishing position' })).toHaveClass(
      'size-16',
    );
    const thumbs = within(viewer)
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-pressed'));
    expect(thumbs).toHaveLength(2);
    fireEvent.click(thumbs[1]!);
    expect(thumbs[1]).toHaveAttribute('aria-pressed', 'true');
    expect(thumbs[0]).toHaveAttribute('aria-pressed', 'false');
    expect(within(viewer).getByText(/public domain/i)).toBeInTheDocument();
  });

  it('shows the muscle map on the muted fill when there is no media', () => {
    renderFigure('A custom movement');
    expect(screen.getByTestId('exercise-media-fallback')).toHaveClass('bg-muted');
    expect(screen.getByRole('group', { name: /chest/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enlarge the technique' })).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RestTimer } from '@/components/session/rest-timer';

vi.mock('@/lib/sound', () => ({ playRestEndBeep: vi.fn() }));

function renderTimer(props: Partial<Parameters<typeof RestTimer>[0]> = {}) {
  const handlers = {
    onEnd: vi.fn(),
    onSkip: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    onAdjust: vi.fn(),
  };
  render(
    <RestTimer
      endsAt={Date.now() + 120_000}
      totalSec={120}
      nextLabel={null}
      unit="KG"
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('RestTimer next-set recommendation', () => {
  it('shows the automatically calculated next set during rest', () => {
    renderTimer({
      nextLabel: 'Back Squat',
      recommendation: {
        mode: 'PRESERVE_REPS',
        weight: 97.5,
        reps: 12,
        rir: 2,
        reason: 'reduce-load',
        predictedRepsAtSameLoad: 11,
        fatigueLoss: 1,
        confidence: 'medium',
      },
    });

    expect(screen.getByText(/97.5 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/× 12 · RIR 2/i)).toBeInTheDocument();
  });
});

describe('RestTimer controls (issue #393)', () => {
  it('adjusts the rest by 15 s in either direction', () => {
    const { onAdjust } = renderTimer();

    fireEvent.click(screen.getByRole('button', { name: 'Add 15 seconds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove 15 seconds' }));

    expect(onAdjust.mock.calls).toEqual([[15_000], [-15_000]]);
  });

  it('offers pause while running and resume while paused', () => {
    const running = renderTimer();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(running.onPause).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
  });

  it('shows the frozen time while paused and does not end at zero', () => {
    vi.useFakeTimers();
    const { onEnd, onResume } = renderTimer({
      endsAt: Date.now() - 5_000,
      pausedRemainingMs: 42_000,
    });

    expect(screen.getByText('Rest paused')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByTestId('rest-remaining')).toHaveTextContent('42');
    expect(onEnd).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('disables -15 s once no time is left', () => {
    renderTimer({ pausedRemainingMs: 0 });
    expect(screen.getByRole('button', { name: 'Remove 15 seconds' })).toBeDisabled();
  });

  it('fills the screen with a lime block that drains as the rest runs out', () => {
    renderTimer({ endsAt: Date.now() + 60_000, totalSec: 120, pausedRemainingMs: 60_000 });

    expect(screen.getByRole('dialog', { name: 'Rest' })).toBeInTheDocument();
    expect(screen.getByTestId('rest-remaining')).toHaveTextContent('01:00');
    const fill = screen.getByTestId('rest-fill');
    expect(fill).toHaveStyle({ height: '50.00%' });
    // 1s linear drain, none with reduced motion.
    expect(fill).toHaveClass('duration-1000', 'ease-linear', 'motion-reduce:transition-none');
    expect(screen.getByRole('button', { name: 'Skip rest' })).toHaveClass('h-touch-session');
  });

  it('names the next set and what was just logged', () => {
    renderTimer({
      nextSet: { number: 3, total: 3 },
      context: 'Bench press · set 2 logged, 82.5 × 7',
    });
    expect(screen.getByText('Next: set 3 of 3')).toBeInTheDocument();
    expect(screen.getByText('Bench press · set 2 logged, 82.5 × 7')).toBeInTheDocument();
  });

  it('folds into a bar over the workout and comes back', () => {
    const onMinimize = vi.fn();
    const onExpand = vi.fn();
    const { rerender } = render(
      <RestTimer
        endsAt={Date.now() + 90_000}
        totalSec={120}
        nextLabel={null}
        unit="KG"
        onEnd={vi.fn()}
        onSkip={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onAdjust={vi.fn()}
        onMinimize={onMinimize}
        onExpand={onExpand}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Back to the workout' }));
    expect(onMinimize).toHaveBeenCalledTimes(1);

    rerender(
      <RestTimer
        endsAt={Date.now() + 90_000}
        totalSec={120}
        nextLabel={null}
        unit="KG"
        onEnd={vi.fn()}
        onSkip={vi.fn()}
        onPause={vi.fn()}
        onResume={vi.fn()}
        onAdjust={vi.fn()}
        minimized
        onMinimize={onMinimize}
        onExpand={onExpand}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show the rest timer/ }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('ends a running rest once its time is up', () => {
    vi.useFakeTimers();
    const { onEnd } = renderTimer({ endsAt: Date.now() + 1_000 });

    act(() => {
      vi.advanceTimersByTime(1_200);
    });

    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

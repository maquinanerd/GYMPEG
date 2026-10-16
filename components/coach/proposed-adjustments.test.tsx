import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProposedAdjustments } from './proposed-adjustments';

afterEach(() => vi.unstubAllGlobals());

const programDefaults = {
  'Dumbbell Shoulder Press': {
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetSets: 3,
    targetRIR: 2,
    restSec: 90,
  },
};

const adjustment = {
  exerciseName: 'Dumbbell Shoulder Press',
  summary: 'Lighter load, higher reps for two weeks.',
  suggestedRepsMin: 12,
  suggestedRepsMax: 15,
  currentLoad: 24,
  suggestedLoad: 20,
};

describe('ProposedAdjustments', () => {
  it('shows before → after and applies nothing until the review is confirmed', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            appliedAt: '2026-10-12T10:00:00.000Z',
            applied: [{ exerciseName: 'Dumbbell Shoulder Press' }],
            skipped: [],
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onApplied = vi.fn();
    render(
      <ProposedAdjustments
        debriefId="debrief-1"
        adjustments={[adjustment]}
        programDefaults={programDefaults}
        appliedAt={null}
        onApplied={onApplied}
      />,
    );

    expect(screen.getByText('Proposed change')).toBeInTheDocument();
    expect(screen.getByText('3 × 8‑12 · 24 kg')).toHaveClass('line-through');
    expect(screen.getByText('Nothing changes until you review and confirm.')).toBeInTheDocument();

    // "Review change" only opens the review.
    await user.click(screen.getByRole('button', { name: 'Review change' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // The lifter confirms there.
    await user.click(screen.getByRole('button', { name: 'Apply 1 adjustment' }));
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/coach/debrief-1/apply',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(await screen.findByText('1 adjustment applied.')).toBeInTheDocument();
    expect(onApplied).toHaveBeenCalledWith('2026-10-12T10:00:00.000Z');
  });

  it('lists several changes on one surface with a single review', () => {
    render(
      <ProposedAdjustments
        debriefId="debrief-1"
        adjustments={[adjustment, { exerciseName: 'Barbell Row', summary: 'Add a set.', suggestedSets: 4 }]}
        programDefaults={programDefaults}
        appliedAt={null}
        onApplied={vi.fn()}
      />,
    );

    expect(screen.getByText('2 proposed changes')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Review changes' })).toHaveLength(1);
  });
});

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RecordsCard, type ExerciseRecordView } from './records-card';

const record = (over: Partial<ExerciseRecordView>): ExerciseRecordView => ({
  exerciseName: 'Squat',
  maxWeight: 100,
  maxWeightReps: 6,
  maxWeightDate: '2026-10-06',
  bestE1RM: 120,
  bestE1RMDate: '2026-10-06',
  ...over,
});

describe('RecordsCard', () => {
  it('marks recent records with the highlighter and older ones muted, newest first', () => {
    render(
      <RecordsCard
        today="2026-10-15"
        unit="KG"
        records={[
          record({ exerciseName: 'Leg press', bestE1RM: 260, bestE1RMDate: '2026-06-01', maxWeightDate: '2026-06-01' }),
          record({ exerciseName: 'Squat' }),
        ]}
      />,
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Squat');
    expect(rows[1]).toHaveTextContent('Leg press');

    const recent = within(rows[0]!).getByText(/120 kg/);
    expect(recent).toHaveClass('bg-pr');
    expect(rows[0]).toHaveTextContent('recent record');
    expect(rows[0]).toHaveTextContent('Heaviest set 100 kg × 6 · 10/06/26');

    const older = within(rows[1]!).getByText('260 kg');
    expect(older).toHaveClass('bg-muted');
    expect(older).not.toHaveClass('bg-pr');
  });

  it('shows an empty state with one action when there is no record', () => {
    render(<RecordsCard today="2026-10-15" unit="KG" records={[]} />);
    expect(screen.getByText('No records yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log a workout' })).toHaveAttribute(
      'href',
      '/session/new',
    );
  });
});

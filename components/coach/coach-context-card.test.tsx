import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoachContextCard } from './coach-context-card';
import type { CoachContextSummary } from '@/lib/coach-context';

function emptySummary(): CoachContextSummary {
  return {
    goals: [],
    stalledExercises: [],
    deloadActive: false,
    deloadRecommended: false,
    deloadReasons: [],
    conditioning: {
      currentMinutes: 0,
      currentKm: 0,
      currentSessions: 0,
      weeklyTargetMin: 150,
    },
    readiness: null,
    weeksOfHistory: 0,
    exercisesTracked: 0,
  };
}

function fullSummary(): CoachContextSummary {
  return {
    goals: [
      {
        exerciseName: 'Bench Press',
        targetWeight: 100,
        targetReps: 5,
        progressPct: 82,
        achieved: false,
      },
      {
        exerciseName: 'Squat',
        targetWeight: 140,
        targetReps: 3,
        progressPct: 100,
        achieved: true,
      },
    ],
    stalledExercises: ['Overhead Press', 'Squat'],
    deloadActive: false,
    deloadRecommended: true,
    deloadReasons: ['2 lifts stalled'],
    conditioning: {
      currentMinutes: 75,
      currentKm: 12.5,
      currentSessions: 2,
      weeklyTargetMin: 150,
    },
    readiness: { daysAgo: 2, readiness: 4, sleepQuality: 3 },
    weeksOfHistory: 6,
    exercisesTracked: 8,
  };
}

// The value next to a row label ("Stalled" → "Overhead Press, Squat").
function valueOf(label: string) {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.nextElementSibling as HTMLElement;
}

describe('CoachContextCard', () => {
  it('shows the context as label · value rows under its heading', () => {
    render(<CoachContextCard summary={fullSummary()} />);
    expect(screen.getByRole('heading', { name: 'What your coach sees' })).toBeInTheDocument();
    expect(valueOf('Stalled')).toHaveTextContent('Overhead Press, Squat');
  });

  it('renders every section of a full context', () => {
    render(<CoachContextCard summary={fullSummary()} />);

    expect(valueOf('History')).toHaveTextContent('6 weeks · 8 exercises');
    expect(screen.getByText('Bench Press 100 kg × 5 · 82%')).toBeInTheDocument();
    expect(screen.getByText('Squat 140 kg × 3 · achieved')).toBeInTheDocument();
    expect(valueOf('Deload')).toHaveTextContent('Recommended: 2 lifts stalled');
    expect(valueOf('Conditioning')).toHaveTextContent('75 of 150 min · 12.5 km · 2 sessions');
    expect(valueOf('Readiness')).toHaveTextContent('4 of 5 · sleep 3 of 5 · 2 days ago');
    expect(
      screen.getByText(
        'A summary the app calculates, plus your recent set-by-set logs. Never your account data or anything outside your training history.',
      ),
    ).toBeInTheDocument();
  });

  it('renders sensible empty states for a fresh user', () => {
    render(<CoachContextCard summary={emptySummary()} />);

    expect(valueOf('History')).toHaveTextContent('No workouts yet');
    expect(valueOf('Goals')).toHaveTextContent('None set');
    expect(valueOf('Stalled')).toHaveTextContent('None');
    expect(valueOf('Deload')).toHaveTextContent('Not needed');
    expect(valueOf('Conditioning')).toHaveTextContent('0 of 150 min · 0 sessions');
    expect(valueOf('Readiness')).toHaveTextContent('No check-in in 7 days');
  });

  it('shows the active deload state instead of a recommendation', () => {
    const summary = { ...fullSummary(), deloadActive: true };
    render(<CoachContextCard summary={summary} />);
    expect(valueOf('Deload')).toHaveTextContent('This week');
    expect(screen.queryByText(/Recommended/)).not.toBeInTheDocument();
  });
});

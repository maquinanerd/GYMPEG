import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => 0 }));
vi.mock('@/lib/sync', () => ({
  countUnsyncedItems: async () => 0,
  flushPendingSets: async () => ({}),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
}));
vi.mock('@/lib/session-lifecycle', () => ({ startSession: vi.fn() }));

import { HomeView, type HomeData, type HomeNext } from './home-view';

const day = (date: number) => new Date(Date.UTC(2026, 9, date, 12));

const nextWorkout: HomeNext = {
  kind: 'next',
  workoutId: 'w1',
  title: 'Lower B',
  kicker: 'Week 3 of 5',
  deload: false,
  scheduledToday: true,
  minutes: 60,
  reason: 'Scheduled for today',
  muscles: ['quads', 'hams', 'glutes', 'calves'],
  exercises: [
    { name: 'Back squat', sets: 4, repsMin: 5, repsMax: 8 },
    { name: 'Leg press', sets: 3, repsMin: 10, repsMax: 12 },
    { name: 'Standing calf raise', sets: 4, repsMin: 10, repsMax: 10 },
  ],
};

function homeData(overrides: Partial<HomeData> = {}): HomeData {
  return {
    name: 'Rafa',
    greeting: 'morning',
    now: new Date(Date.UTC(2026, 9, 15, 10)),
    timeZone: 'UTC',
    unit: 'KG',
    week: [
      { key: '2026-10-12', date: day(12), status: 'trained', trained: true },
      { key: '2026-10-13', date: day(13), status: 'trained', trained: true },
      { key: '2026-10-14', date: day(14), status: 'rest', trained: false },
      { key: '2026-10-15', date: day(15), status: 'today', trained: false },
      { key: '2026-10-16', date: day(16), status: 'planned', trained: false },
      { key: '2026-10-17', date: day(17), status: 'rest', trained: false },
      { key: '2026-10-18', date: day(18), status: 'rest', trained: false },
    ],
    next: nextWorkout,
    weekStats: { sessionsDone: 2, sessionsPlanned: 4, setsDone: 33, setsPrescribed: 66 },
    insight: null,
    records: [],
    weight: null,
    ...overrides,
  };
}

function todayBlock() {
  return screen.getByTestId('next-workout');
}

describe('HomeView', () => {
  it('greets with the date and the name, without an avatar', () => {
    render(<HomeView data={homeData()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Rafa' })).toBeInTheDocument();
    expect(screen.getByText('Thursday, October 15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Everything is synced' })).toBeInTheDocument();
    expect(screen.queryByText('RA')).not.toBeInTheDocument();
  });

  it("puts today's workout in the lime block with its exercises and the start button", () => {
    render(<HomeView data={homeData()} />);
    const block = todayBlock();
    expect(block).toHaveClass('bg-primary');
    expect(screen.getByRole('region', { name: 'Lower B' })).toBe(block);
    expect(within(block).getByText('Today · Week 3 of 5')).toBeInTheDocument();

    const list = within(block).getByRole('list', { name: 'Exercises of this workout' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Back squat');
    expect(rows[0]).toHaveTextContent('4 × 5‑8');
    // A fixed target reads as one number.
    expect(rows[2]).toHaveTextContent('4 × 10');

    expect(within(block).getByRole('button', { name: 'Start workout' })).toHaveClass('bg-ink');
    expect(within(block).getByText('Scheduled for today · ~60 min')).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'Switch workout' })).toHaveAttribute(
      'href',
      '/session/new',
    );
    expect(within(block).getByRole('group', { name: /quads/i })).toBeInTheDocument();
  });

  it('tags a deload week and leaves "Today" out when the workout is not scheduled today', () => {
    render(
      <HomeView
        data={homeData({ next: { ...nextWorkout, deload: true, scheduledToday: false } })}
      />,
    );
    const block = todayBlock();
    expect(within(block).getByText('Week 3 of 5')).toBeInTheDocument();
    expect(within(block).getByText('Deload')).toHaveClass('bg-deload');
  });

  it('folds a long workout after six exercises', () => {
    const exercises = Array.from({ length: 9 }, (_, index) => ({
      name: `Exercise ${index + 1}`,
      sets: 3,
      repsMin: 8,
      repsMax: 12,
    }));
    render(<HomeView data={homeData({ next: { ...nextWorkout, exercises } })} />);
    const block = todayBlock();
    expect(within(block).getAllByRole('listitem')).toHaveLength(6);
    expect(within(block).getByText('+ 3 more exercises')).toBeInTheDocument();
  });

  it('offers to resume the workout in progress', () => {
    render(
      <HomeView
        data={homeData({
          next: {
            kind: 'inProgress',
            sessionId: 's1',
            title: 'Lower B',
            elapsedMinutes: 24,
            setsDone: 6,
            setsTotal: 17,
            muscles: ['quads'],
            exercises: nextWorkout.kind === 'next' ? nextWorkout.exercises : [],
          },
        })}
      />,
    );
    const block = todayBlock();
    expect(within(block).getByText('In progress · 24 min')).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'Resume workout' })).toHaveAttribute(
      'href',
      '/session/s1',
    );
    expect(within(block).getByText('6 of 17 sets logged')).toBeInTheDocument();
    expect(within(block).queryByRole('link', { name: 'Switch workout' })).not.toBeInTheDocument();
  });

  it('uses the same lime block for an account without a program', () => {
    render(<HomeView data={homeData({ next: { kind: 'noProgram' } })} />);
    const block = todayBlock();
    expect(within(block).getByRole('heading', { name: 'Pick a program' })).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'Choose a program' })).toHaveAttribute(
      'href',
      '/programs/new/template',
    );
    expect(within(block).getByRole('link', { name: 'Build one from scratch' })).toHaveAttribute(
      'href',
      '/programs/new',
    );
  });

  it('sends a brand-new account to onboarding', () => {
    render(<HomeView data={homeData({ next: { kind: 'new' } })} />);
    const block = todayBlock();
    expect(within(block).getByText('5 steps: goal, days and equipment.')).toBeInTheDocument();
    expect(within(block).getByRole('link', { name: 'Get started' })).toHaveAttribute(
      'href',
      '/onboarding',
    );
  });

  it('shows the week strip and the two numbers against the plan', () => {
    render(<HomeView data={homeData()} />);
    const week = screen.getByRole('region', { name: 'This week' });
    expect(within(week).getByText(/Oct 12/)).toBeInTheDocument();
    expect(within(week).getByLabelText('Thursday, October 15: today')).toBeInTheDocument();
    expect(within(week).getByLabelText('Monday, October 12: workout done')).toBeInTheDocument();
    const stats = screen.getByTestId('weekly-adherence');
    expect(stats).toHaveTextContent('2of 4 workouts');
    expect(stats).toHaveTextContent('33of 66 sets');
    expect(stats.querySelectorAll('[role="progressbar"]')).toHaveLength(2);
  });

  it('counts the week without bars when there is no plan', () => {
    render(
      <HomeView
        data={homeData({
          weekStats: { sessionsDone: 1, sessionsPlanned: null, setsDone: 12, setsPrescribed: null },
        })}
      />,
    );
    const stats = screen.getByTestId('weekly-adherence');
    expect(stats).toHaveTextContent('1workout this week');
    expect(stats).toHaveTextContent('12sets this week');
    expect(stats.querySelectorAll('[role="progressbar"]')).toHaveLength(0);
  });

  it('shows the one computed alert as a tag, a linked title and the detail', () => {
    render(
      <HomeView
        data={homeData({
          insight: {
            kind: 'stall',
            title: 'A lift has stalled',
            detail: 'Dumbbell press has not progressed recently.',
            href: '/progress',
          },
        })}
      />,
    );
    const alert = screen.getByRole('region', { name: 'A lift has stalled' });
    expect(within(alert).getByText('Stalled')).toHaveClass('bg-warning');
    expect(within(alert).getByRole('link', { name: 'A lift has stalled' })).toHaveAttribute(
      'href',
      '/progress',
    );
    expect(alert).toHaveTextContent('Dumbbell press has not progressed recently.');
  });

  it('marks the new value of each record with the highlighter', () => {
    render(
      <HomeView
        data={homeData({
          records: [
            {
              id: 'r1',
              type: 'REPS',
              exerciseName: 'Back squat',
              value: 6,
              previousValue: 5,
              weightKg: 100,
              achievedAt: new Date(Date.UTC(2026, 9, 6, 12)),
            },
            {
              id: 'r2',
              type: 'E1RM',
              exerciseName: 'Bench press',
              value: 94,
              previousValue: 91,
              weightKg: null,
              achievedAt: new Date(Date.UTC(2026, 9, 2, 12)),
            },
          ],
        })}
      />,
    );
    const list = screen.getByTestId('recent-records');
    const [reps, e1rm] = within(list).getAllByRole('listitem');
    expect(reps).toHaveTextContent('Back squat');
    expect(reps).toHaveTextContent('100 kg · 10/06');
    expect(reps).toHaveTextContent('before × 5');
    expect(within(reps!).getByText('× 6')).toHaveClass('bg-pr');
    expect(e1rm).toHaveTextContent('Estimated 1RM · 10/02');
    expect(within(e1rm!).getByText('94 kg')).toHaveClass('bg-pr');
    expect(screen.getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/progress');
  });

  it('hides the records block when there is none', () => {
    render(<HomeView data={homeData()} />);
    expect(screen.queryByTestId('recent-records')).not.toBeInTheDocument();
  });

  it('shows the bodyweight with its trend and a sparkline', () => {
    render(
      <HomeView
        data={homeData({
          weight: {
            latestKg: 78,
            averageKg: 78.1,
            ratePerWeekKg: -0.1,
            series: [
              { at: day(1), kg: 78.4 },
              { at: day(8), kg: 78.2 },
              { at: day(15), kg: 78 },
            ],
          },
        })}
      />,
    );
    const weight = screen.getByTestId('home-weight');
    expect(within(weight).getByRole('heading', { name: 'Bodyweight' })).toBeInTheDocument();
    expect(weight).toHaveTextContent('78.0kg');
    expect(weight).toHaveTextContent(/7-day average 78\.1 · −0\.1 kg per week/);
    const line = within(weight).getByTestId('weight-sparkline');
    expect(line.querySelector('polyline')).toHaveAttribute('fill', 'none');
    expect(line.querySelector('polyline')).toHaveAttribute('stroke-width', '2');
  });

  it('draws no sparkline from a single weigh-in', () => {
    render(
      <HomeView
        data={homeData({
          weight: {
            latestKg: 78,
            averageKg: null,
            ratePerWeekKg: null,
            series: [{ at: day(15), kg: 78 }],
          },
        })}
      />,
    );
    expect(screen.queryByTestId('weight-sparkline')).not.toBeInTheDocument();
  });
});

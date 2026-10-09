import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HistoryFilters } from './history-filters';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  query: 'month=2026-09',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

const baseProps = {
  programs: [{ id: 'program-1', name: 'Strength' }],
  gyms: [{ id: 'gym-1', name: 'Downtown' }],
  exercises: [{ id: 'exercise-1', name: 'Bench press' }],
  muscles: ['CHEST' as const],
  selectedMonth: '2026-09',
};

describe('HistoryFilters', () => {
  beforeEach(() => {
    navigation.push.mockReset();
    navigation.query = 'month=2026-09&tz=UTC';
  });

  it('offers one select per filter and no clear button without filters', () => {
    render(<HistoryFilters {...baseProps} filters={{}} />);

    for (const label of ['Program', 'Gym', 'Exercise', 'Muscle']) {
      expect(screen.getByRole('combobox', { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /CSV/ })).toHaveAttribute('href', '/api/history/csv');
  });

  it('exports the CSV for the active filters', () => {
    render(
      <HistoryFilters {...baseProps} filters={{ gymId: 'gym-1', exerciseId: 'exercise-1' }} />,
    );

    expect(screen.getByRole('link', { name: /CSV/ })).toHaveAttribute(
      'href',
      '/api/history/csv?gymId=gym-1&exerciseId=exercise-1',
    );
  });

  it('clears every filter but keeps the month and the zone', () => {
    navigation.query = 'month=2026-09&day=2026-09-12&tz=UTC&programId=program-1&muscle=CHEST';
    render(<HistoryFilters {...baseProps} filters={{ programId: 'program-1', muscle: 'CHEST' }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    const href = navigation.push.mock.calls[0]?.[0] as string;
    const params = new URLSearchParams(href.split('?')[1]);
    expect(params.get('month')).toBe('2026-09');
    expect(params.get('tz')).toBe('UTC');
    expect(params.has('day')).toBe(false);
    expect(params.has('programId')).toBe(false);
    expect(params.has('muscle')).toBe(false);
  });
});

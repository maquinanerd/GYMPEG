import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BodyweightCard } from './bodyweight-card';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

function lastFetchCall(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined];
}

const entries = [
  { id: 'b2', weightKg: 81.2, measuredAt: '2026-06-08T08:00:00Z' },
  { id: 'b1', weightKg: 80, measuredAt: '2026-06-01T08:00:00Z' },
];

describe('BodyweightCard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('shows the current bodyweight from the newest entry', () => {
    render(<BodyweightCard entries={entries} unit="KG" />);
    expect(screen.getByText(/current: 81.2 kg/i)).toBeInTheDocument();
  });

  it('shows an empty state when nothing is logged yet', () => {
    render(<BodyweightCard entries={[]} unit="KG" />);
    expect(screen.getByText(/no bodyweight logged yet/i)).toBeInTheDocument();
  });

  it('posts the quick-add weight in kg, converting from the display unit (lb)', async () => {
    const user = userEvent.setup();
    render(<BodyweightCard entries={[]} unit="LB" />);

    await user.type(screen.getByLabelText(/bodyweight \(lb\)/i), '180');
    await user.click(screen.getByRole('button', { name: 'Log' }));

    const [url, init] = lastFetchCall(fetchMock);
    expect(url).toBe('/api/bodyweight');
    const body = JSON.parse(init?.body as string) as { weightKg: number };
    // 180 lb = 81.65 kg.
    expect(body.weightKg).toBeCloseTo(81.65, 1);
    expect(refresh).toHaveBeenCalled();
  });

  it('rejects an empty or non-positive weight without calling the API', async () => {
    const user = userEvent.setup();
    render(<BodyweightCard entries={[]} unit="KG" />);

    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes an entry through the API', async () => {
    const user = userEvent.setup();
    render(<BodyweightCard entries={entries} unit="KG" />);

    await user.click(screen.getAllByRole('button', { name: /delete entry/i })[0] as HTMLElement);

    const [url, init] = lastFetchCall(fetchMock);
    expect(url).toBe('/api/bodyweight/b2');
    expect(init?.method).toBe('DELETE');
    expect(refresh).toHaveBeenCalled();
  });

  it('lists entries in the display unit', () => {
    render(<BodyweightCard entries={entries} unit="LB" />);
    // 80 kg = 176.4 lb.
    expect(screen.getByText(/176.4 lb/)).toBeInTheDocument();
  });
});

describe('BodyweightCard trend (epic 2.4)', () => {
  it('shows the 7-day average, its change per period and the weekly rate', () => {
    render(
      <BodyweightCard
        entries={entries}
        unit="KG"
        trend={{
          averageKg: 80.6,
          changeKg: { d7: -0.4, d30: -1.2, d90: null },
          ratePerWeekKg: -0.3,
          series: [
            { day: '2026-06-01', weightKg: 80, averageKg: 80 },
            { day: '2026-06-08', weightKg: 81.2, averageKg: 80.6 },
          ],
        }}
      />,
    );
    const trend = screen.getByTestId('bodyweight-trend');
    expect(trend).toHaveTextContent('7-day average: 80.6 kg');
    expect(trend).toHaveTextContent('7 days: −0.4 kg');
    expect(trend).toHaveTextContent('30 days: −1.2 kg');
    expect(trend).toHaveTextContent('90 days: not enough data');
    expect(trend).toHaveTextContent('Rate over 30 days: −0.3 kg/week');
  });
});

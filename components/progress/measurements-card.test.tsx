import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MeasurementsCard, type BodyMeasurementView } from './measurements-card';

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

const entries: BodyMeasurementView[] = [
  { id: 'm3', site: 'WAIST', valueCm: 82, measuredAt: '2026-06-08T08:00:00Z' },
  { id: 'm2', site: 'WAIST', valueCm: 84, measuredAt: '2026-06-01T08:00:00Z' },
  { id: 'm1', site: 'HIPS', valueCm: 95, measuredAt: '2026-06-01T08:00:00Z' },
];

describe('MeasurementsCard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('lists the latest value per site with its date', () => {
    render(<MeasurementsCard entries={entries} unit="KG" />);
    const list = screen.getByRole('region', { name: 'Measurements' });
    // Latest waist (newest entry m3 = 82) and hips (95); the older waist (84)
    // is history, never a "latest".
    expect(within(list).getByText('82 cm')).toBeInTheDocument();
    expect(within(list).getByText('95 cm')).toBeInTheDocument();
    expect(within(list).queryByText('84 cm')).not.toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /waist: 82 cm on 06\/08/i })).toBeInTheDocument();
  });

  it('shows the site history in the sheet, older values included', async () => {
    const user = userEvent.setup();
    render(<MeasurementsCard entries={entries} unit="KG" />);
    await user.click(screen.getByRole('button', { name: /waist: 82 cm/i }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('84 cm')).toBeInTheDocument();
    expect(within(sheet).getByRole('img', { name: /waist from 84 cm/i })).toBeInTheDocument();
  });

  it('shows an empty state, and an empty trend message for a site with no data', async () => {
    const user = userEvent.setup();
    render(<MeasurementsCard entries={[]} unit="KG" />);
    expect(screen.getByText(/no measurements yet/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Log' }));
    expect(screen.getByText(/no waist measurement yet/i)).toBeInTheDocument();
  });

  it('posts the value in cm for the selected site (metric)', async () => {
    const user = userEvent.setup();
    render(<MeasurementsCard entries={[]} unit="KG" />);

    await user.click(screen.getByRole('button', { name: 'Log' }));
    await user.type(screen.getByLabelText(/value \(cm\)/i), '82.5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const [url, init] = lastFetchCall(fetchMock);
    expect(url).toBe('/api/measurements');
    const body = JSON.parse(init?.body as string) as { site: string; valueCm: number };
    expect(body.site).toBe('WAIST');
    expect(body.valueCm).toBeCloseTo(82.5, 6);
    expect(refresh).toHaveBeenCalled();
  });

  it('converts inches to cm before posting (imperial)', async () => {
    const user = userEvent.setup();
    render(<MeasurementsCard entries={[]} unit="LB" />);

    await user.click(screen.getByRole('button', { name: 'Log' }));
    await user.type(screen.getByLabelText(/value \(in\)/i), '32');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const [, init] = lastFetchCall(fetchMock);
    const body = JSON.parse(init?.body as string) as { valueCm: number };
    // 32 in = 81.28 cm.
    expect(body.valueCm).toBeCloseTo(81.28, 2);
  });

  it('rejects an empty value without calling the API', async () => {
    const user = userEvent.setup();
    render(<MeasurementsCard entries={[]} unit="KG" />);
    await user.click(screen.getByRole('button', { name: 'Log' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes the selected-site entry through the API', async () => {
    const user = userEvent.setup();
    render(<MeasurementsCard entries={entries} unit="KG" />);
    await user.click(screen.getByRole('button', { name: 'Log' }));
    // Default site is WAIST; the first deletable row is the newest waist (m3).
    await user.click(
      screen.getAllByRole('button', { name: /delete waist measurement/i })[0] as HTMLElement,
    );
    const [url, init] = lastFetchCall(fetchMock);
    expect(url).toBe('/api/measurements/m3');
    expect(init?.method).toBe('DELETE');
    expect(refresh).toHaveBeenCalled();
  });

  it('switches the trend and list to the chosen site', async () => {
    const user = userEvent.setup();
    render(<MeasurementsCard entries={entries} unit="KG" />);
    await user.click(screen.getByRole('button', { name: 'Log' }));
    await user.selectOptions(screen.getByLabelText(/^site$/i), 'HIPS');
    // Hips has a single entry -> the "log a second" trend message appears.
    expect(screen.getByText(/log a second hips measurement/i)).toBeInTheDocument();
  });
});

describe('MeasurementsCard body fat (epic 2.4)', () => {
  it('shows the estimate with the measurements it rests on, and nothing without one', () => {
    const { rerender } = render(
      <MeasurementsCard
        entries={entries}
        unit="KG"
        bodyFat={{ percent: 16.6, basedOn: '2026-06-01T08:00:00Z', usesHips: false }}
      />,
    );
    expect(screen.getByTestId('body-fat')).toHaveTextContent('Estimated body fat');
    expect(screen.getByTestId('body-fat')).toHaveTextContent('16.6%');
    expect(screen.getByTestId('body-fat-hint')).toHaveTextContent(/waist, neck and height/);

    rerender(<MeasurementsCard entries={entries} unit="KG" bodyFat={null} />);
    expect(screen.queryByTestId('body-fat')).not.toBeInTheDocument();
  });
});

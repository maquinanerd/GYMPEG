import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VolumeRows, type VolumeRow } from './volume-rows';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const row = (over: Partial<VolumeRow>): VolumeRow => ({
  group: 'CHEST',
  label: 'Chest',
  sets: 12,
  frequency: 2,
  zone: 'WITHIN',
  mev: 10,
  mrv: 20,
  custom: false,
  ...over,
});

describe('VolumeRows', () => {
  it('reads each muscle with its sets, status, band and frequency', () => {
    render(
      <VolumeRows
        defaultBand={{ mev: 10, mrv: 20 }}
        rows={[
          row({}),
          row({ group: 'BACK_WIDTH', label: 'Back', sets: 23, zone: 'ABOVE_MRV', custom: true, mrv: 22 }),
          row({ group: 'BICEPS', label: 'Biceps', sets: 4, zone: 'BELOW_MEV', frequency: 1 }),
        ]}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Chest: 12 sets, in range. Band 10–20, 2x/week. Edit the band.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Back: 23 sets, above\. Band 10–22 \(custom\)/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Biceps: 4 sets, below/ })).toBeInTheDocument();
    // The fill takes the heat color of its zone.
    expect(document.querySelector('[data-zone="ABOVE_MRV"]')).toHaveClass('bg-heat-3');
    expect(document.querySelector('[data-zone="BELOW_MEV"]')).toHaveClass('bg-heat-1');
    expect(document.querySelector('[data-zone="WITHIN"]')).toHaveClass('bg-heat-2');
  });

  it('opens the band editor from the row', async () => {
    const user = userEvent.setup();
    render(<VolumeRows defaultBand={{ mev: 10, mrv: 20 }} rows={[row({})]} />);
    await user.click(screen.getByRole('button', { name: /^Chest:/ }));
    expect(screen.getByRole('dialog', { name: 'Chest volume target' })).toBeInTheDocument();
  });
});

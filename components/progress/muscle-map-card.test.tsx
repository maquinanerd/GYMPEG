import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MuscleMapCard } from './muscle-map-card';
import { buildMuscleMap } from '@/lib/muscle-map';

const WEEK = 'Week of Aug 10 – 16';

describe('MuscleMapCard (week map)', () => {
  it('titles the block and shows the heat legend next to the figure', () => {
    render(<MuscleMapCard regions={buildMuscleMap({ CHEST: 14 })} weekLabel={WEEK} />);

    expect(screen.getByRole('region', { name: 'Week map' })).toBeInTheDocument();
    for (const level of ['Untrained', 'Below MEV', 'In range', 'Above MRV']) {
      expect(screen.getByText(level)).toBeInTheDocument();
    }
    expect(screen.getByTestId('muscle-map-detail')).toHaveTextContent(WEEK);
  });

  it('paints each muscle by its level against the band', () => {
    // 14 sets sit inside the default 10-20 band; 25 sits above it; 4 below.
    render(
      <MuscleMapCard
        regions={buildMuscleMap({ CHEST: 14, QUADS: 25, BICEPS: 4 })}
        weekLabel={WEEK}
      />,
    );

    expect(screen.getByRole('img', { name: 'chest: within range' })).toHaveClass('fill-heat-2');
    expect(screen.getByRole('img', { name: 'quads: above MRV' })).toHaveClass('fill-heat-3');
    expect(screen.getByRole('img', { name: 'biceps: below MEV' })).toHaveClass('fill-heat-1');
    expect(screen.getByRole('img', { name: 'abs: untrained' })).toHaveClass('fill-heat-0');
  });

  it('takes the hottest group for a shape covering several (back)', () => {
    render(
      <MuscleMapCard
        regions={buildMuscleMap({ BACK_WIDTH: 4, BACK_THICKNESS: 25 })}
        weekLabel={WEEK}
      />,
    );
    expect(screen.getByRole('img', { name: 'back: above MRV' })).toHaveClass('fill-heat-3');
  });

  it('says so when no muscle was trained that week', () => {
    render(<MuscleMapCard regions={buildMuscleMap({})} weekLabel={WEEK} />);
    expect(screen.getByTestId('muscle-map-detail')).toHaveTextContent(
      /no working sets that week/i,
    );
  });
});

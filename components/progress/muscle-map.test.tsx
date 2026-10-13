import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MuscleMap } from './muscle-map';

describe('MuscleMap (compact figure)', () => {
  it('labels the figure with the lit muscles and paints them heat-2', () => {
    render(<MuscleMap active={['quads', 'hams', 'glutes', 'calves']} size={104} />);
    const figure = screen.getByRole('group', {
      name: 'Muscles worked: quads, calves, glutes, hamstrings',
    });
    expect(figure).toHaveAttribute('width', '104');
    expect(figure).toHaveAttribute('height', '101');
    expect(screen.getByRole('img', { name: 'quads' })).toHaveClass('fill-heat-2');
    // Unlit muscles stay off and silent.
    expect(screen.queryByRole('img', { name: 'chest' })).toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(4);
  });

  it('reads every muscle with its status in heat-map mode', () => {
    render(<MuscleMap levels={{ chest: 3, back: 1 }} />);
    expect(screen.getByRole('img', { name: 'chest: above MRV' })).toHaveClass('fill-heat-3');
    expect(screen.getByRole('img', { name: 'back: below MEV' })).toHaveClass('fill-heat-1');
    expect(screen.getByRole('img', { name: 'abs: untrained' })).toHaveClass('fill-heat-0');
    expect(screen.getAllByRole('img')).toHaveLength(11);
  });

  it('says so when nothing is lit', () => {
    render(<MuscleMap />);
    expect(screen.getByRole('group', { name: 'No muscles to show' })).toBeInTheDocument();
  });
});

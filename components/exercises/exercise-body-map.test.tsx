import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { exerciseMuscleMap } from '@/lib/muscle-map';
import { ExerciseBodyMap } from './exercise-body-map';

describe('ExerciseBodyMap', () => {
  it('labels the primary and secondary muscles on both views', () => {
    render(
      <ExerciseBodyMap
        regions={exerciseMuscleMap([
          { group: 'CHEST', share: 1 },
          { group: 'TRICEPS', share: 0.5 },
        ])}
      />,
    );

    expect(screen.getByRole('group', { name: 'Front' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Chest: Primary' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Triceps: Secondary' })).toHaveLength(2);
    // Untouched regions are decoration, not announced.
    expect(screen.queryByRole('img', { name: /Quads/ })).not.toBeInTheDocument();
  });

  it('renders nothing when the exercise works no mapped muscle', () => {
    const { container } = render(<ExerciseBodyMap regions={exerciseMuscleMap([])} />);
    expect(container).toBeEmptyDOMElement();
  });
});

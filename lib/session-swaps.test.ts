import { describe, expect, it } from 'vitest';
import { applyExerciseSwaps, parseExerciseSwaps } from './session-swaps';

const bench = { id: 'bench', name: 'Bench press' };
const incline = { id: 'incline', name: 'Incline press' };
const row = { id: 'row', name: 'Row' };

const rows = [
  { id: 'pe-1', exerciseId: 'bench', exercise: bench, targetSets: 4 },
  { id: 'pe-2', exerciseId: 'row', exercise: row, targetSets: 3 },
];

describe('applyExerciseSwaps', () => {
  it('puts the replacement in its row and keeps the prescription', () => {
    const swapped = applyExerciseSwaps(
      rows,
      { 'pe-1': 'incline' },
      new Map([['incline', incline]]),
    );

    expect(swapped[0]).toEqual({
      id: 'pe-1',
      exerciseId: 'incline',
      exercise: incline,
      targetSets: 4,
    });
    expect(swapped[1]).toBe(rows[1]);
  });

  it('ignores swaps to an unknown exercise or back to the row’s own', () => {
    const swapped = applyExerciseSwaps(
      rows,
      { 'pe-1': 'deleted', 'pe-2': 'row' },
      new Map([['row', row]]),
    );

    expect(swapped).toEqual(rows);
  });
});

describe('parseExerciseSwaps', () => {
  it('reads a stored map and treats anything else as no swaps', () => {
    expect(parseExerciseSwaps({ 'pe-1': 'incline' })).toEqual({ 'pe-1': 'incline' });
    expect(parseExerciseSwaps(null)).toEqual({});
    expect(parseExerciseSwaps(['pe-1'])).toEqual({});
    expect(parseExerciseSwaps({ 'pe-1': 42 })).toEqual({});
  });
});

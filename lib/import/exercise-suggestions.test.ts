import { describe, expect, it } from 'vitest';
import { parseRpeCell } from './csv';
import { suggestExercises } from './exercise-suggestions';

const candidates = [
  { id: 'bench', name: 'Barbell bench press' },
  { id: 'wide', name: 'Wide-grip barbell bench press' },
  { id: 'close', name: 'Close-grip bench press' },
  { id: 'squat', name: 'Barbell back squat' },
  { id: 'mine', name: 'Meu supino caseiro' },
];

describe('suggestExercises', () => {
  it('ranks the closest catalog names, through their terms and pt-BR names', () => {
    expect(suggestExercises('Bench Press (Barbell)', candidates).map((c) => c.id)).toEqual([
      'bench',
      'close',
      'wide',
    ]);
    expect(suggestExercises('Supino reto', candidates)[0]?.id).toBe('bench');
  });

  it('suggests nothing when too few words match', () => {
    expect(suggestExercises('Kettlebell swing', candidates)).toEqual([]);
    expect(suggestExercises('(  )', candidates)).toEqual([]);
  });
});

describe('parseRpeCell', () => {
  it('reads 6 to 10 in half steps and ignores anything else', () => {
    expect(parseRpeCell('8')).toBe(8);
    expect(parseRpeCell('8,5')).toBe(8.5);
    expect(parseRpeCell(' 9.4 ')).toBe(9.5);
    expect(parseRpeCell('')).toBeNull();
    expect(parseRpeCell('5')).toBeNull();
    expect(parseRpeCell('11')).toBeNull();
    expect(parseRpeCell('hard')).toBeNull();
    expect(parseRpeCell(undefined)).toBeNull();
  });
});

describe('suggestExercises stop words', () => {
  it('ignores words that say nothing about the movement', () => {
    expect(
      suggestExercises('Supino da academia', [{ id: 'own', name: 'Supino com halteres' }]),
    ).toEqual([{ id: 'own', name: 'Supino com halteres' }]);
  });
});

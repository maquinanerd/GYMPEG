import { describe, expect, it } from 'vitest';
import { offlineAwareHref, offlineTarget } from './offline-navigation';

describe('offlineAwareHref', () => {
  it('keeps the path while online', () => {
    expect(offlineAwareHref('/session/abc', true)).toBe('/session/abc');
  });

  it('goes through the offline page while offline', () => {
    expect(offlineAwareHref('/session/abc?programExerciseId=pe-1', false)).toBe(
      '/~offline?to=%2Fsession%2Fabc%3FprogramExerciseId%3Dpe-1',
    );
    expect(offlineAwareHref('/', false)).toBe('/~offline');
  });
});

describe('offlineTarget', () => {
  it('reads back the screen asked for', () => {
    expect(offlineTarget(`?to=${encodeURIComponent('/session/abc?programExerciseId=pe-1')}`)).toBe(
      '/session/abc?programExerciseId=pe-1',
    );
  });

  it('ignores a missing or foreign target', () => {
    expect(offlineTarget('')).toBeNull();
    expect(offlineTarget('?to=https%3A%2F%2Fevil.example')).toBeNull();
    expect(offlineTarget('?to=%2F%2Fevil.example')).toBeNull();
  });
});

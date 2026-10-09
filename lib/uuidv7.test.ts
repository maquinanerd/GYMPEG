import { describe, expect, it } from 'vitest';
import { isUuidV7, uuidv7, uuidv7Time } from './uuidv7';

describe('uuidv7', () => {
  it('produces a version 7 UUID that carries its creation time', () => {
    const id = uuidv7(1_760_000_000_123);
    expect(isUuidV7(id)).toBe(true);
    expect(uuidv7Time(id)).toBe(1_760_000_000_123);
  });

  it('sorts ids of different milliseconds by creation time', () => {
    const ids = [uuidv7(3_000), uuidv7(1_000), uuidv7(2_000)];
    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('never repeats within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 500 }, () => uuidv7(5_000)));
    expect(ids.size).toBe(500);
  });

  it('rejects other UUID versions and arbitrary strings', () => {
    expect(isUuidV7('3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e')).toBe(false); // v4
    expect(isUuidV7('cm1abcdef0000000000000000')).toBe(false); // cuid
    expect(isUuidV7('../../etc/passwd')).toBe(false);
  });
});

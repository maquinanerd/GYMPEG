import { describe, expect, it } from 'vitest';
import { generatePassword, GENERATED_PASSWORD_LENGTH } from '@/lib/random-password';

describe('generatePassword', () => {
  it('has the default length and passes the 8-character minimum', () => {
    const password = generatePassword();
    expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH);
    expect(password.length).toBeGreaterThanOrEqual(8);
  });

  it('never uses look-alike characters', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generatePassword()).not.toMatch(/[0O1lI]/);
    }
  });

  it('changes on every call', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(seen.size).toBe(50);
  });

  it('drops the biased top bytes instead of folding them onto the alphabet', () => {
    // 220 is the first byte past the largest multiple of 55 (the alphabet
    // size): it must be skipped, not mapped to a character.
    const bytes = [255, 220, 0, 54, 55];
    let call = 0;
    const randomBytes = (size: number) =>
      Uint8Array.from({ length: size }, () => bytes[call++ % bytes.length] ?? 0);
    expect(generatePassword(3, randomBytes)).toBe('a9a');
  });
});

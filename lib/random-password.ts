// Random password an admin hands over to someone: no look-alike characters
// (0/O, 1/l/I), so it survives being read aloud or typed from a screenshot.
// 14 characters from 55 symbols is about 80 bits.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const GENERATED_PASSWORD_LENGTH = 14;

type RandomBytes = (size: number) => Uint8Array;

const cryptoBytes: RandomBytes = (size) => crypto.getRandomValues(new Uint8Array(size));

export function generatePassword(
  length: number = GENERATED_PASSWORD_LENGTH,
  randomBytes: RandomBytes = cryptoBytes,
): string {
  // Bytes at or above the largest multiple of the alphabet size are dropped,
  // so the modulo below keeps every character equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

// UUID version 7 (RFC 9562): 48-bit Unix time in milliseconds, then random
// bits. Generated on the device for entities created offline (ADR-004), so
// the id is known before the server is reached and doubles as the
// idempotency key. Time-ordered, so the ids of one device sort by creation.

export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function uuidv7(now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Bytes 0-5: timestamp, big-endian. Division keeps the 48 bits exact
  // (bitwise operators would truncate to 32).
  let time = Math.max(0, Math.floor(now));
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = time % 256;
    time = Math.floor(time / 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isUuidV7(value: string): boolean {
  return UUID_V7_PATTERN.test(value);
}

// Milliseconds encoded in a UUIDv7 (for tests and diagnostics).
export function uuidv7Time(value: string): number {
  return Number.parseInt(value.replace(/-/g, '').slice(0, 12), 16);
}

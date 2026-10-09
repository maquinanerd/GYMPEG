import { describe, expect, it } from 'vitest';
import { ImageMetadataError, stripImageMetadata } from './image-metadata';

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const segment = (marker: number, payload: number[]) => {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
};
// EXIF payload: big-endian TIFF with Orientation (0x0112) and a GPS-like tag.
const exifPayload = (orientation: number) => [
  ...ascii('Exif'),
  0,
  0,
  0x4d,
  0x4d,
  0x00,
  0x2a,
  0x00,
  0x00,
  0x00,
  0x08,
  0x00,
  0x02,
  0x01,
  0x12,
  0x00,
  0x03,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  orientation,
  0x00,
  0x00,
  0x88,
  0x25,
  0x00,
  0x04,
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x2a,
  0x00,
  0x00,
  0x00,
  0x00,
];
const jfif = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const scan = [0xff, 0xda, 0x00, 0x04, 0x01, 0x00, 0x12, 0x34, 0x56, 0xff, 0xd9];

const includes = (haystack: Uint8Array, needle: number[]) =>
  Buffer.from(haystack).includes(Buffer.from(needle));

describe('stripImageMetadata: JPEG', () => {
  const jpeg = (orientation: number) =>
    Uint8Array.from([
      0xff,
      0xd8,
      ...jfif,
      ...segment(0xe1, exifPayload(orientation)),
      ...segment(0xe1, [...ascii('http://ns.adobe.com/xap/1.0/'), 0, ...ascii('<x:xmpmeta/>')]),
      ...segment(0xed, ascii('Photoshop 3.0')),
      ...segment(0xfe, ascii('shot by me')),
      ...segment(0xe2, [...ascii('ICC_PROFILE'), 0, 1, 1]),
      ...scan,
    ]);

  it('drops EXIF, XMP, IPTC and comments but keeps JFIF, ICC and the image data', () => {
    const out = stripImageMetadata(jpeg(1), 'image/jpeg');
    expect(includes(out, [0x88, 0x25])).toBe(false); // GPS pointer gone
    expect(includes(out, ascii('xmpmeta'))).toBe(false);
    expect(includes(out, ascii('Photoshop'))).toBe(false);
    expect(includes(out, ascii('shot by me'))).toBe(false);
    expect(includes(out, ascii('Exif'))).toBe(false); // orientation 1 needs no EXIF
    expect(includes(out, ascii('JFIF'))).toBe(true);
    expect(includes(out, ascii('ICC_PROFILE'))).toBe(true);
    expect([...out.subarray(-scan.length)]).toEqual(scan);
  });

  it('keeps only the orientation, so a rotated photo still shows upright', () => {
    const out = stripImageMetadata(jpeg(6), 'image/jpeg');
    expect(includes(out, ascii('Exif'))).toBe(true);
    expect(includes(out, [0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06])).toBe(true);
    expect(includes(out, [0x88, 0x25])).toBe(false);
    // Right after SOI + JFIF.
    expect([...out.subarray(2 + jfif.length, 2 + jfif.length + 2)]).toEqual([0xff, 0xe1]);
  });

  it('keeps a tail it cannot parse instead of refusing the file', () => {
    const odd = Uint8Array.from([0xff, 0xd8, ...segment(0xfe, ascii('note')), 0x00, 0x01, 0x02]);
    const out = stripImageMetadata(odd, 'image/jpeg');
    expect([...out]).toEqual([0xff, 0xd8, 0x00, 0x01, 0x02]);
    expect(() => stripImageMetadata(Uint8Array.from([0x00, 0x01]), 'image/jpeg')).toThrow(
      ImageMetadataError,
    );
  });
});

describe('stripImageMetadata: nothing to remove', () => {
  it('returns the original bytes untouched', () => {
    const plain = Uint8Array.from([0xff, 0xd8, ...jfif, ...scan]);
    expect(stripImageMetadata(plain, 'image/jpeg')).toBe(plain);
    // A WebP whose RIFF size is off is still not rewritten when nothing is removed.
    const webp = Uint8Array.from([
      ...ascii('RIFF'),
      99,
      0,
      0,
      0,
      ...ascii('WEBP'),
      ...ascii('VP8 '),
      2,
      0,
      0,
      0,
      1,
      2,
    ]);
    expect(stripImageMetadata(webp, 'image/webp')).toBe(webp);
  });
});

describe('stripImageMetadata: PNG', () => {
  const chunk = (type: string, data: number[]) => [
    0,
    0,
    0,
    data.length,
    ...ascii(type),
    ...data,
    0xde,
    0xad,
    0xbe,
    0xef,
  ];
  const png = Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk('IHDR', Array(13).fill(1)),
    ...chunk('tEXt', ascii('Author\0me')),
    ...chunk('eXIf', [1, 2, 3]),
    ...chunk('tIME', [7, 0xea, 10, 9, 12, 0, 0]),
    ...chunk('IDAT', [9, 9, 9]),
    ...chunk('IEND', []),
  ]);

  it('drops text, EXIF and time chunks and keeps the image chunks', () => {
    const out = stripImageMetadata(png, 'image/png');
    expect(includes(out, ascii('tEXt'))).toBe(false);
    expect(includes(out, ascii('eXIf'))).toBe(false);
    expect(includes(out, ascii('tIME'))).toBe(false);
    for (const kept of ['IHDR', 'IDAT', 'IEND']) expect(includes(out, ascii(kept))).toBe(true);
  });
});

describe('stripImageMetadata: WebP', () => {
  const chunk = (type: string, data: number[]) => [
    ...ascii(type),
    data.length,
    0,
    0,
    0,
    ...data,
    ...(data.length % 2 ? [0] : []),
  ];
  const body = [
    ...chunk('VP8X', [0x0c, 0, 0, 0, 1, 0, 0, 1, 0, 0]),
    ...chunk('VP8 ', [1, 2, 3, 4]),
    ...chunk('EXIF', [5, 6, 7]),
    ...chunk('XMP ', [8, 9]),
  ];
  const size = body.length + 4;
  const webp = Uint8Array.from([
    ...ascii('RIFF'),
    size & 0xff,
    size >> 8,
    0,
    0,
    ...ascii('WEBP'),
    ...body,
  ]);

  it('drops EXIF and XMP, clears their flags and fixes the RIFF size', () => {
    const out = stripImageMetadata(webp, 'image/webp');
    expect(includes(out, ascii('EXIF'))).toBe(false);
    expect(includes(out, ascii('XMP '))).toBe(false);
    expect(includes(out, ascii('VP8 '))).toBe(true);
    // VP8X flags: EXIF (0x08) and XMP (0x04) bits cleared.
    expect(out[20]! & 0x0c).toBe(0);
    const riffSize = out[4]! | (out[5]! << 8) | (out[6]! << 16) | (out[7]! << 24);
    expect(riffSize).toBe(out.length - 8);
  });
});

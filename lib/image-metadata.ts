// Removes metadata from uploaded images (G3, ADR-006): a phone photo carries
// the GPS position, the camera serial and the time it was taken, which a
// progress photo has no reason to keep (LGPD). Byte-level and dependency-free:
// - JPEG: drops APP1 (EXIF, XMP), APP13 (IPTC) and comments; keeps the image
//   data, JFIF, the ICC color profile and Adobe markers. The EXIF orientation
//   is the one tag kept, rewritten as a minimal EXIF block, so the photo does
//   not come back rotated;
// - PNG: drops the text chunks (tEXt, zTXt, iTXt), eXIf and tIME;
// - WebP: drops the EXIF and XMP chunks and clears their flags.
// Parsing goes as far as the structure allows: known metadata blocks seen
// on the way are dropped and an unparseable tail is kept as it is, so no image
// a browser can show is ever refused. Only bytes that are not the declared
// format at all raise ImageMetadataError.

import type { ProgressPhotoMime } from '@/lib/progress-photo';

export class ImageMetadataError extends Error {}

export function stripImageMetadata(bytes: Uint8Array, mime: ProgressPhotoMime): Uint8Array {
  switch (mime) {
    case 'image/jpeg':
      return stripJpeg(bytes);
    case 'image/png':
      return stripPng(bytes);
    case 'image/webp':
      return stripWebp(bytes);
  }
}

// ---------- JPEG ----------

const APP1 = 0xe1;
const APP13 = 0xed;
const COM = 0xfe;
const SOS = 0xda;
const EOI = 0xd9;

function stripJpeg(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new ImageMetadataError('Not a JPEG.');
  const kept: Uint8Array[] = [bytes.subarray(0, 2)];
  let orientation: number | null = null;
  let changed = false;
  let offset = 2;
  while (offset < bytes.length) {
    // Past what can be parsed, the rest is kept as it is.
    if (bytes[offset] !== 0xff) {
      kept.push(bytes.subarray(offset));
      break;
    }
    const marker = bytes[offset + 1]!;
    // Fill bytes between segments.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    if (marker === EOI) {
      kept.push(bytes.subarray(offset, offset + 2));
      break;
    }
    // Standalone markers (RSTn, TEM) carry no length.
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      kept.push(bytes.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }
    if (offset + 4 > bytes.length) {
      kept.push(bytes.subarray(offset));
      break;
    }
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!;
    const end = offset + 2 + length;
    if (length < 2 || end > bytes.length) {
      kept.push(bytes.subarray(offset));
      break;
    }
    if (marker === SOS) {
      // The entropy-coded data runs to the end: keep everything from here.
      kept.push(bytes.subarray(offset));
      break;
    }
    const segment = bytes.subarray(offset, end);
    if (marker === APP1) {
      orientation ??= exifOrientation(segment.subarray(4));
      changed = true;
    } else if (marker === APP13 || marker === COM) {
      changed = true;
    } else {
      kept.push(segment);
    }
    offset = end;
  }
  // Nothing to remove: the original bytes, untouched.
  if (!changed) return bytes;
  if (orientation != null && orientation !== 1) {
    // Right after SOI (and JFIF when present), as EXIF is expected to sit.
    const at = kept.length > 1 && kept[1]![1] === 0xe0 ? 2 : 1;
    kept.splice(at, 0, minimalExifSegment(orientation));
  }
  return concat(kept);
}

// Orientation (tag 0x0112) of an APP1 EXIF payload, or null.
function exifOrientation(payload: Uint8Array): number | null {
  const exifHeader = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  if (payload.length < 14 || !exifHeader.every((b, i) => payload[i] === b)) return null;
  const tiff = payload.subarray(6);
  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return null;
  const u16 = (at: number) =>
    little ? tiff[at]! | (tiff[at + 1]! << 8) : (tiff[at]! << 8) | tiff[at + 1]!;
  const u32 = (at: number) =>
    little
      ? (tiff[at]! | (tiff[at + 1]! << 8) | (tiff[at + 2]! << 16) | (tiff[at + 3]! << 24)) >>> 0
      : ((tiff[at]! << 24) | (tiff[at + 1]! << 16) | (tiff[at + 2]! << 8) | tiff[at + 3]!) >>> 0;
  const ifd = u32(4);
  if (ifd + 2 > tiff.length) return null;
  const entries = u16(ifd);
  for (let i = 0; i < entries; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > tiff.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

// APP1 "Exif" with a big-endian TIFF header and one IFD entry: Orientation.
function minimalExifSegment(orientation: number): Uint8Array {
  const tiff = [
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // MM, 42, IFD at 8
    0x00,
    0x01, // one entry
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01, // Orientation, SHORT, count 1
    0x00,
    orientation,
    0x00,
    0x00, // value
    0x00,
    0x00,
    0x00,
    0x00, // no next IFD
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
  const length = payload.length + 2;
  return Uint8Array.from([0xff, APP1, length >> 8, length & 0xff, ...payload]);
}

// ---------- PNG ----------

const PNG_DROPPED = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME']);

function stripPng(bytes: Uint8Array): Uint8Array {
  const kept: Uint8Array[] = [bytes.subarray(0, 8)];
  let changed = false;
  let offset = 8;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      kept.push(bytes.subarray(offset));
      break;
    }
    const length =
      ((bytes[offset]! << 24) |
        (bytes[offset + 1]! << 16) |
        (bytes[offset + 2]! << 8) |
        bytes[offset + 3]!) >>>
      0;
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const end = offset + 12 + length;
    if (end > bytes.length) {
      kept.push(bytes.subarray(offset));
      break;
    }
    if (PNG_DROPPED.has(type)) changed = true;
    else kept.push(bytes.subarray(offset, end));
    offset = end;
    if (type === 'IEND') break;
  }
  return changed ? concat(kept) : bytes;
}

// ---------- WebP ----------

const VP8X_EXIF_FLAG = 0x08;
const VP8X_XMP_FLAG = 0x04;

function stripWebp(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 12) return bytes;
  const kept: Uint8Array[] = [];
  let changed = false;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size =
      (bytes[offset + 4]! |
        (bytes[offset + 5]! << 8) |
        (bytes[offset + 6]! << 16) |
        (bytes[offset + 7]! << 24)) >>>
      0;
    const end = offset + 8 + size + (size % 2);
    if (offset + 8 + size > bytes.length) break;
    const chunk = bytes.slice(offset, Math.min(end, bytes.length));
    if (type === 'VP8X' && chunk.length > 8 && chunk[8]! & (VP8X_EXIF_FLAG | VP8X_XMP_FLAG)) {
      chunk[8] = chunk[8]! & ~(VP8X_EXIF_FLAG | VP8X_XMP_FLAG);
      changed = true;
    }
    if (type === 'EXIF' || type === 'XMP ') changed = true;
    else kept.push(chunk);
    offset = end;
  }
  if (!changed) return bytes;
  if (offset < bytes.length) kept.push(bytes.subarray(offset));
  const body = concat(kept);
  const riffSize = body.length + 4; // "WEBP" + chunks
  const header = Uint8Array.from([
    0x52,
    0x49,
    0x46,
    0x46,
    riffSize & 0xff,
    (riffSize >> 8) & 0xff,
    (riffSize >> 16) & 0xff,
    (riffSize >> 24) & 0xff,
    0x57,
    0x45,
    0x42,
    0x50,
  ]);
  return concat([header, body]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

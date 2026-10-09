import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deletePhotoFile,
  deleteUserPhotoDir,
  readPhotoFile,
  writePhotoFile,
} from '@/lib/progress-photo';
import { objectStorageFromEnv } from '@/lib/storage/config';

// Progress photos in the private bucket (ADR-006) when STORAGE_PROVIDER=s3.

const ENV = {
  STORAGE_PROVIDER: 's3',
  S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  S3_BUCKET: 'gympeg-private',
  S3_ACCESS_KEY_ID: 'key',
  S3_SECRET_ACCESS_KEY: 'secret',
};
const BASE = 'https://account.r2.cloudflarestorage.com/gympeg-private';

describe('progress photos in the object storage bucket', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('writes, reads and deletes under progress-photos/<user>/<photo>', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([7, 8]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await writePhotoFile('user1/photo1.webp', new Uint8Array([7, 8]));
    expect(await readPhotoFile('user1/photo1.webp')).toEqual(new Uint8Array([7, 8]));
    await deletePhotoFile('user1/photo1.webp');

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      `PUT ${BASE}/progress-photos/user1/photo1.webp`,
      `GET ${BASE}/progress-photos/user1/photo1.webp`,
      `DELETE ${BASE}/progress-photos/user1/photo1.webp`,
    ]);
    expect(fetchMock.mock.calls[0]![1].headers['content-type']).toBe('image/webp');
  });

  it("removes every object of a user's folder on account deletion", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          '<ListBucketResult><Contents><Key>progress-photos/user1/a.jpg</Key></Contents>' +
            '<Contents><Key>progress-photos/user1/b.png</Key></Contents>' +
            '<IsTruncated>false</IsTruncated></ListBucketResult>',
        ),
      )
      .mockResolvedValue(new Response(null, { status: 204 }));

    await deleteUserPhotoDir('user1');

    expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
      `GET ${BASE}?list-type=2&prefix=progress-photos%2Fuser1%2F`,
      `DELETE ${BASE}/progress-photos/user1/a.jpg`,
      `DELETE ${BASE}/progress-photos/user1/b.png`,
    ]);
  });

  it('copies a photo stored before the bucket on its first read', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'gympeg-photos-'));
    vi.stubEnv('UPLOADS_DIR', dir);
    try {
      await mkdir(path.join(dir, 'progress-photos', 'user1'), { recursive: true });
      await writeFile(path.join(dir, 'progress-photos', 'user1', 'old.png'), Buffer.from([4, 2]));
      fetchMock
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      expect(await readPhotoFile('user1/old.png')).toEqual(new Uint8Array([4, 2]));
      expect(fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`)).toEqual([
        `GET ${BASE}/progress-photos/user1/old.png`,
        `PUT ${BASE}/progress-photos/user1/old.png`,
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('never sends a path it did not generate', async () => {
    await expect(readPhotoFile('../other/photo.jpg')).rejects.toThrow(
      'Invalid progress-photo path.',
    );
    await expect(writePhotoFile('user1/photo.gif', new Uint8Array([1]))).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('objectStorageFromEnv', () => {
  it('uses the local disk unless s3 is chosen, and refuses a half configuration', () => {
    expect(objectStorageFromEnv({})).toBeNull();
    expect(() => objectStorageFromEnv({ STORAGE_PROVIDER: 's3', S3_BUCKET: 'b' })).toThrow(
      /needs S3_ENDPOINT/,
    );
    expect(objectStorageFromEnv(ENV)).not.toBeNull();
  });
});

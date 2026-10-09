// Which object storage the private files use (ADR-006):
// - STORAGE_PROVIDER=s3 with S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and
//   S3_SECRET_ACCESS_KEY (S3_REGION defaults to "auto", Cloudflare R2's);
// - unset: the local uploads directory (development, and production until a
//   bucket is configured).
// A half-configured S3 is an error, never a silent fallback to local disk.

import { createS3Client, type S3Client } from '@/lib/storage/s3';

type Env = Record<string, string | undefined>;

let cached: { key: string; client: S3Client | null } | null = null;

export function objectStorageFromEnv(env: Env = process.env): S3Client | null {
  if (env.STORAGE_PROVIDER?.trim().toLowerCase() !== 's3') return null;
  const endpoint = env.S3_ENDPOINT?.trim();
  const bucket = env.S3_BUCKET?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'STORAGE_PROVIDER=s3 needs S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.',
    );
  }
  const key = [endpoint, bucket, accessKeyId].join('|');
  if (cached?.key !== key) {
    cached = {
      key,
      client: createS3Client({
        endpoint,
        bucket,
        accessKeyId,
        secretAccessKey,
        region: env.S3_REGION?.trim() || 'auto',
      }),
    };
  }
  return cached.client;
}

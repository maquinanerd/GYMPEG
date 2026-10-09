import { describe, expect, it, vi } from 'vitest';
import { createS3Client, signS3Request } from './s3';

// The worked examples of the AWS documentation ("Signature Calculations for
// the Authorization Header: Transferring Payload in a Single Chunk").
const config = {
  region: 'us-east-1',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
};
const now = new Date('2013-05-24T00:00:00Z');
const host = 'examplebucket.s3.amazonaws.com';
const EMPTY_SHA = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const signatureOf = (authorization: string) => /Signature=([0-9a-f]+)/.exec(authorization)?.[1];

describe('signS3Request (AWS SigV4 worked examples)', () => {
  it('GET Object', () => {
    const signed = signS3Request({
      config,
      method: 'GET',
      host,
      path: '/test.txt',
      payloadHash: EMPTY_SHA,
      extraHeaders: { Range: 'bytes=0-9' },
      now,
    });
    expect(signed.headers.Authorization).toContain(
      'SignedHeaders=host;range;x-amz-content-sha256;x-amz-date',
    );
    expect(signatureOf(signed.headers.Authorization!)).toBe(
      'f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('PUT Object, with a key that needs encoding', () => {
    const signed = signS3Request({
      config,
      method: 'PUT',
      host,
      path: '/test$file.text',
      payloadHash: '44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072',
      extraHeaders: {
        Date: 'Fri, 24 May 2013 00:00:00 GMT',
        'x-amz-storage-class': 'REDUCED_REDUNDANCY',
      },
      now,
    });
    expect(signatureOf(signed.headers.Authorization!)).toBe(
      '98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd',
    );
    expect(signed.url).toBe('https://examplebucket.s3.amazonaws.com/test%24file.text');
  });

  it('GET Bucket (list objects), with a query string', () => {
    const signed = signS3Request({
      config,
      method: 'GET',
      host,
      path: '/',
      query: { 'max-keys': '2', prefix: 'J' },
      payloadHash: EMPTY_SHA,
      now,
    });
    expect(signatureOf(signed.headers.Authorization!)).toBe(
      '34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7',
    );
  });
});

describe('createS3Client', () => {
  const s3Config = {
    endpoint: 'https://account.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'gympeg-private',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
  };

  it('puts, gets and deletes objects with path-style URLs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createS3Client(s3Config, fetchMock as unknown as typeof fetch);

    await client.put('progress-photos/u1/p1.jpg', new Uint8Array([1, 2, 3]), 'image/jpeg');
    expect(await client.get('progress-photos/u1/p1.jpg')).toEqual(new Uint8Array([1, 2, 3]));
    expect(await client.get('progress-photos/u1/missing.jpg')).toBeNull();
    await client.delete('progress-photos/u1/p1.jpg');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'https://account.r2.cloudflarestorage.com/gympeg-private/progress-photos/u1/p1.jpg',
    );
    expect(init.method).toBe('PUT');
    expect(init.headers['content-type']).toBe('image/jpeg');
    expect(init.headers.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=key\/\d{8}\/auto\/s3/);
  });

  it('lists every key of a prefix across pages', async () => {
    const page = (keys: string[], next?: string) =>
      new Response(
        `<ListBucketResult>${keys.map((k) => `<Contents><Key>${k}</Key></Contents>`).join('')}` +
          `<IsTruncated>${next ? 'true' : 'false'}</IsTruncated>` +
          (next ? `<NextContinuationToken>${next}</NextContinuationToken>` : '') +
          '</ListBucketResult>',
        { status: 200 },
      );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(['a/1.jpg', 'a/2.jpg'], 'tok&en'))
      .mockResolvedValueOnce(page(['a/3.jpg']));
    const client = createS3Client(s3Config, fetchMock as unknown as typeof fetch);

    expect(await client.list('a/')).toEqual(['a/1.jpg', 'a/2.jpg', 'a/3.jpg']);
    expect(fetchMock.mock.calls[1]![0]).toContain('continuation-token=tok%26en');
  });

  it('fails loudly without echoing the response', async () => {
    const client = createS3Client(
      s3Config,
      vi
        .fn()
        .mockResolvedValue(
          new Response('AccessDenied', { status: 403 }),
        ) as unknown as typeof fetch,
    );
    await expect(client.put('k', new Uint8Array([1]), 'image/png')).rejects.toThrow(
      'Object storage upload failed (HTTP 403).',
    );
  });
});

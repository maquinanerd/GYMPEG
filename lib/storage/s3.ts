// Minimal S3-compatible client (G3, ADR-006): put, get, delete and list by
// prefix on one private bucket, signed with AWS Signature Version 4. Works with
// Cloudflare R2, AWS S3 and MinIO (path-style URLs). No SDK: four operations
// on node:crypto and fetch are easier to audit than a large dependency tree.

import { createHash, createHmac } from 'node:crypto';

export interface S3Config {
  endpoint: string; // e.g. https://<account>.r2.cloudflarestorage.com
  region: string; // "auto" on R2
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const sha256Hex = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex');
const hmac = (key: string | Buffer, data: string) =>
  createHmac('sha256', key).update(data).digest();

// RFC 3986 encoding as SigV4 wants it; "/" kept in object keys.
function encodePath(path: string): string {
  return path
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

function encodeQuery(params: Record<string, string>): string {
  return Object.keys(params)
    .sort()
    .map(
      (key) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key]!).replace(
          /[!'()*]/g,
          (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
        )}`,
    )
    .join('&');
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

// Signs one request. `extraHeaders` are signed too (lower-case names).
export function signS3Request(input: {
  config: Pick<S3Config, 'region' | 'accessKeyId' | 'secretAccessKey'>;
  method: string;
  host: string;
  path: string; // already including the bucket for path-style
  query?: Record<string, string>;
  payloadHash: string;
  extraHeaders?: Record<string, string>;
  now: Date;
  origin?: string;
}): SignedRequest {
  const amzDate = input.now
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const date = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    host: input.host,
    'x-amz-content-sha256': input.payloadHash,
    'x-amz-date': amzDate,
    ...Object.fromEntries(
      Object.entries(input.extraHeaders ?? {}).map(([k, v]) => [k.toLowerCase(), v.trim()]),
    ),
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => `${name}:${headers[name]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalQuery = encodeQuery(input.query ?? {});
  const canonicalRequest = [
    input.method,
    encodePath(input.path),
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n');
  const scope = `${date}/${input.config.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256Hex(canonicalRequest)].join('\n');
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.config.secretAccessKey}`, date), input.config.region), 's3'),
    'aws4_request',
  );
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  const { host: _host, ...sent } = headers;
  return {
    url: `${input.origin ?? `https://${input.host}`}${encodePath(input.path)}${
      canonicalQuery ? `?${canonicalQuery}` : ''
    }`,
    headers: {
      ...sent,
      Authorization: `AWS4-HMAC-SHA256 Credential=${input.config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

export class S3Error extends Error {
  constructor(
    public status: number,
    operation: string,
  ) {
    super(`Object storage ${operation} failed (HTTP ${status}).`);
  }
}

// `fetchImpl` defaults to the global fetch, looked up at each call.
export function createS3Client(config: S3Config, fetchImpl?: typeof fetch) {
  const endpoint = new URL(config.endpoint);
  const send = async (
    method: string,
    key: string,
    options: {
      body?: Uint8Array;
      query?: Record<string, string>;
      headers?: Record<string, string>;
    } = {},
  ) => {
    const body = options.body;
    const signed = signS3Request({
      config,
      method,
      host: endpoint.host,
      origin: endpoint.origin,
      path: `/${config.bucket}${key ? `/${key}` : ''}`,
      query: options.query,
      payloadHash: sha256Hex(body ?? ''),
      extraHeaders: options.headers,
      now: new Date(),
    });
    return (fetchImpl ?? fetch)(signed.url, {
      method,
      headers: signed.headers,
      ...(body ? { body: Buffer.from(body) } : {}),
      signal: AbortSignal.timeout(30_000),
    });
  };

  return {
    async put(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
      const res = await send('PUT', key, { body: bytes, headers: { 'content-type': contentType } });
      if (!res.ok) throw new S3Error(res.status, 'upload');
    },
    async get(key: string): Promise<Uint8Array | null> {
      const res = await send('GET', key);
      if (res.status === 404) return null;
      if (!res.ok) throw new S3Error(res.status, 'download');
      return new Uint8Array(await res.arrayBuffer());
    },
    async delete(key: string): Promise<void> {
      const res = await send('DELETE', key);
      // S3 answers 204 whether or not the key existed.
      if (!res.ok && res.status !== 404) throw new S3Error(res.status, 'delete');
    },
    async list(prefix: string): Promise<string[]> {
      const keys: string[] = [];
      let token: string | undefined;
      do {
        const res = await send('GET', '', {
          query: {
            'list-type': '2',
            prefix,
            ...(token ? { 'continuation-token': token } : {}),
          },
        });
        if (!res.ok) throw new S3Error(res.status, 'list');
        const xml = await res.text();
        for (const match of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(decodeXml(match[1]!));
        token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
          ? decodeXml(
              /<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '',
            )
          : undefined;
      } while (token);
      return keys;
    },
  };
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export type S3Client = ReturnType<typeof createS3Client>;

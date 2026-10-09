// Content-Security-Policy with a per-request nonce (G1 hardening).
//
// The middleware draws a fresh nonce for every request, sends the policy on
// the response and on the request headers: Next.js reads the nonce from the
// request policy and stamps it on its own scripts, and the root layout passes
// it to next-themes for its inline theme script. 'strict-dynamic' lets those
// trusted scripts load the app chunks. Every page is rendered per request (the
// root layout reads the locale cookie), so no prerendered HTML misses the
// nonce.
//
// Styles keep 'unsafe-inline': Radix and the charts set inline style
// attributes, which a nonce cannot cover.

export const NONCE_HEADER = 'x-nonce';

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildContentSecurityPolicy(nonce: string, options: { dev?: boolean } = {}) {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React's dev tooling evaluates code; never in production.
    ...(options.dev ? ["'unsafe-eval'"] : []),
  ];
  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    // blob: previews a photo before upload; data: covers inline SVG icons.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

// PWA via @ducanh2912/next-pwa (the maintained successor to next-pwa, which
// did not support Next 15). The workbox-level options (runtimeCaching,
// buildExcludes, skipWaiting) live under workboxOptions.
//
// Offline model (ADR-004): the service worker never stores authenticated
// HTML or API responses. A page navigation that cannot reach the server gets
// the precached offline page (app/~offline), which runs the workout from the
// device's IndexedDB (outbox + training pack). Only static assets are cached.
const withPWA = require('@ducanh2912/next-pwa').default({
  dest: 'public',
  register: true,
  // Disabled in dev to avoid aggressive caching during hot-reload.
  disable: process.env.NODE_ENV === 'development',
  // The start URL is the signed-in dashboard: not cached either.
  cacheStartUrl: false,
  fallbacks: { document: '/~offline' },
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
    // Do not pre-cache API routes: too volatile and auth-dependent.
    exclude: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
    runtimeCaching: [
      {
        // App pages: always from the network. The route exists so that a
        // failed navigation falls back to the offline page (next-pwa hooks
        // the fallback on runtime routes) instead of the browser's error page.
        //
        // NetworkFirst only because Workbox allows a network timeout on no
        // other handler (gym wifi that connects but never answers must reach
        // the offline page, not load forever). Nothing is ever stored: the
        // cacheable-response rule requires a header no response carries.
        urlPattern: ({ request, url }) =>
          request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages-never-stored',
          networkTimeoutSeconds: 10,
          cacheableResponse: { headers: { 'x-gympeg-cache-page': 'never-set' } },
        },
      },
      {
        // Static assets: CacheFirst (long-lived).
        urlPattern: ({ url }) =>
          url.pathname.startsWith('/_next/static/') ||
          /\.(?:png|svg|webp|ico|woff2?)$/.test(url.pathname),
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
    ],
  },
});
const withNextIntl = require('next-intl/plugin')('./i18n/request.ts');

// Baseline security headers for every response. The CSP only carries the
// directives that cannot break Next.js inline scripts (no script-src yet: a
// nonce-based policy is planned with the Next 16 upgrade).
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), screen-wake-lock=(self)',
  },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = withPWA(withNextIntl(nextConfig));

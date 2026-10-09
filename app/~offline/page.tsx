import { OfflineApp } from '@/components/offline/offline-app';

// Offline page (ADR-004). Precached by the service worker and served for any
// page navigation that cannot reach the server (next.config.js `fallbacks`).
// It holds no account data: everything it shows comes from this device's
// IndexedDB, read client-side. Public in the middleware so the service
// worker can precache it.
export default function OfflinePage() {
  return <OfflineApp />;
}

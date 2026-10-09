// Navigation while the device knows it is offline (ADR-004). The offline
// page (app/~offline) is in the service worker precache, so going to it
// directly needs no network round trip: no wait for a request to fail, and no
// dependence on how the browser treats the worker's own network access. The
// page then shows `to` and puts it back in the address bar, so a later reload
// reopens the same screen (through the service worker fallback when offline,
// from the server when online).

export const OFFLINE_PAGE = '/~offline';

// Where to send the lifter for `path`: the page itself while online, the
// offline page showing it while offline.
export function offlineAwareHref(path: string, online = isOnline()): string {
  if (online) return path;
  return path === '/' ? OFFLINE_PAGE : `${OFFLINE_PAGE}?to=${encodeURIComponent(path)}`;
}

// The screen an offline page URL asks for: a same-origin path, or null.
export function offlineTarget(search: string): string | null {
  const to = new URLSearchParams(search).get('to');
  if (!to || !to.startsWith('/') || to.startsWith('//')) return null;
  return to;
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine;
}

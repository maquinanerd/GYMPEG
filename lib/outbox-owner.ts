// The account the offline outbox belongs to on this device (ADR-004: the
// outbox is scoped per user). Every queued item records its owner, and a
// flush only sends the items of the signed-in account: another account's
// pending sets wait on the device until that account signs in again.
//
// Set from the protected layout (server-known user id). Mirrored in
// localStorage so the offline shell, which has no server, still knows whose
// local sessions it may show. Cleared on logout.

const OWNER_KEY = 'gympeg.outbox.owner';

let currentOwner: string | null = null;

export function setOutboxOwner(ownerId: string | null): void {
  currentOwner = ownerId;
  try {
    if (ownerId) window.localStorage.setItem(OWNER_KEY, ownerId);
    else window.localStorage.removeItem(OWNER_KEY);
  } catch {
    // Storage blocked (private mode): the in-memory owner still applies.
  }
}

export function getOutboxOwner(): string | null {
  if (currentOwner) return currentOwner;
  try {
    return window.localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

// Items queued before the outbox was scoped carry no owner: they belong to
// whoever is signed in (the server still checks ownership on every write).
export function ownedBy(ownerId: string | null, item: { ownerId?: string | null }): boolean {
  return item.ownerId == null || item.ownerId === ownerId;
}

// When a set "happened". Offline sets reach the server late (minutes or hours
// after they were performed), so the device clock is the right source, within
// bounds: device clocks drift and a client must not plant sets far in the
// future or long before the session.

export const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const MAX_BEFORE_SESSION_MS = 12 * 60 * 60 * 1000;

export function resolvePerformedAt(
  performedAtMs: number | undefined,
  context: { now: Date; sessionStartedAt: Date },
): Date {
  if (performedAtMs === undefined) return context.now;
  if (performedAtMs > context.now.getTime() + MAX_FUTURE_SKEW_MS) return context.now;
  if (performedAtMs < context.sessionStartedAt.getTime() - MAX_BEFORE_SESSION_MS) {
    return context.sessionStartedAt;
  }
  return new Date(performedAtMs);
}

// A finished session still accepts a set logged offline BEFORE it was
// finished (the "finish" may have come from another device, or the queue
// drained after a reconnect). It must carry an idempotency key, so a replay
// can never add it twice. Anything performed after the finish is refused.
export function acceptsSetAfterFinish(
  finishedAt: Date | null,
  performedAt: Date,
  clientMutationId: string | undefined,
): boolean {
  if (!finishedAt) return true;
  return clientMutationId !== undefined && performedAt.getTime() <= finishedAt.getTime();
}

import { describe, expect, it } from 'vitest';
import {
  acceptsSetAfterFinish,
  MAX_BEFORE_SESSION_MS,
  MAX_FUTURE_SKEW_MS,
  resolveFinishedAt,
  resolvePerformedAt,
  resolveStartedAt,
} from './set-timing';

const now = new Date('2026-10-09T12:00:00Z');
const sessionStartedAt = new Date('2026-10-09T10:00:00Z');
const ctx = { now, sessionStartedAt };

describe('resolvePerformedAt', () => {
  it('uses the server clock when the client sends nothing', () => {
    expect(resolvePerformedAt(undefined, ctx)).toEqual(now);
  });

  it('keeps an offline timestamp from earlier in the session', () => {
    const t = Date.parse('2026-10-09T10:42:00Z');
    expect(resolvePerformedAt(t, ctx).getTime()).toBe(t);
  });

  it('tolerates small clock skew but caps timestamps in the future', () => {
    const slightlyAhead = now.getTime() + MAX_FUTURE_SKEW_MS - 1000;
    expect(resolvePerformedAt(slightlyAhead, ctx).getTime()).toBe(slightlyAhead);
    expect(resolvePerformedAt(now.getTime() + MAX_FUTURE_SKEW_MS + 1, ctx)).toEqual(now);
  });

  it('pulls absurdly old timestamps back to the session start', () => {
    const tooOld = sessionStartedAt.getTime() - MAX_BEFORE_SESSION_MS - 1;
    expect(resolvePerformedAt(tooOld, ctx)).toEqual(sessionStartedAt);
  });
});

describe('resolveStartedAt', () => {
  it('uses the server clock when the client sends nothing or a future time', () => {
    expect(resolveStartedAt(undefined, now)).toEqual(now);
    expect(resolveStartedAt(now.getTime() + 1, now)).toEqual(now);
  });

  it('keeps the device time of a start queued offline', () => {
    const t = Date.parse('2026-10-08T18:00:00Z');
    expect(resolveStartedAt(t, now).getTime()).toBe(t);
  });
});

describe('resolveFinishedAt', () => {
  it('uses the server clock when the client sends nothing or a future time', () => {
    expect(resolveFinishedAt(undefined, ctx)).toEqual(now);
    expect(resolveFinishedAt(now.getTime() + 60_000, ctx)).toEqual(now);
  });

  it('keeps the device time of a finish queued offline', () => {
    const t = Date.parse('2026-10-09T11:15:00Z');
    expect(resolveFinishedAt(t, ctx).getTime()).toBe(t);
  });

  it('never finishes before the session started', () => {
    expect(resolveFinishedAt(sessionStartedAt.getTime() - 1, ctx)).toEqual(sessionStartedAt);
  });
});

describe('acceptsSetAfterFinish', () => {
  const finishedAt = new Date('2026-10-09T11:30:00Z');

  it('accepts anything while the session is open', () => {
    expect(acceptsSetAfterFinish(null, now, undefined)).toBe(true);
  });

  it('accepts a keyed set performed before the finish', () => {
    expect(
      acceptsSetAfterFinish(finishedAt, new Date('2026-10-09T11:10:00Z'), 'loc_abc12345'),
    ).toBe(true);
  });

  it('refuses sets after the finish or without an idempotency key', () => {
    expect(acceptsSetAfterFinish(finishedAt, now, 'loc_abc12345')).toBe(false);
    expect(acceptsSetAfterFinish(finishedAt, new Date('2026-10-09T11:10:00Z'), undefined)).toBe(
      false,
    );
  });
});

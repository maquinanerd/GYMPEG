import { describe, expect, it } from 'vitest';
import {
  anchorForCurrentWeek,
  cycleWeekAt,
  deloadPrescription,
  prescriptionsForWeek,
  programCycle,
  type ProgramCycle,
} from './program-cycle';

// Week 1 started on Monday 2026-10-05 (UTC).
const cycle: ProgramCycle = {
  weeks: 4,
  deloadWeek: 4,
  anchor: new Date('2026-10-05T00:00:00Z'),
};

describe('cycleWeekAt', () => {
  it('counts calendar weeks from the anchor and repeats the cycle', () => {
    expect(cycleWeekAt(cycle, new Date('2026-10-05T08:00:00Z'), 'UTC')).toBe(1);
    expect(cycleWeekAt(cycle, new Date('2026-10-11T23:00:00Z'), 'UTC')).toBe(1); // Sunday
    expect(cycleWeekAt(cycle, new Date('2026-10-12T00:30:00Z'), 'UTC')).toBe(2); // Monday
    expect(cycleWeekAt(cycle, new Date('2026-10-26T10:00:00Z'), 'UTC')).toBe(4);
    expect(cycleWeekAt(cycle, new Date('2026-11-02T10:00:00Z'), 'UTC')).toBe(1);
  });

  it('counts backwards before the anchor', () => {
    expect(cycleWeekAt(cycle, new Date('2026-10-04T10:00:00Z'), 'UTC')).toBe(4);
  });

  it("uses the user's calendar, not UTC", () => {
    // Monday 02:00 UTC is still Sunday evening in São Paulo: week 1 has not
    // turned into week 2 there.
    const local: ProgramCycle = {
      ...cycle,
      anchor: anchorForCurrentWeek(1, new Date('2026-10-07T15:00:00Z'), 'America/Sao_Paulo'),
    };
    expect(cycleWeekAt(local, new Date('2026-10-12T02:00:00Z'), 'America/Sao_Paulo')).toBe(1);
    expect(cycleWeekAt(local, new Date('2026-10-12T04:00:00Z'), 'America/Sao_Paulo')).toBe(2);
  });
});

describe('anchorForCurrentWeek', () => {
  it('puts the given week on the current calendar week', () => {
    const now = new Date('2026-10-21T12:00:00Z'); // Wednesday
    const anchor = anchorForCurrentWeek(3, now, 'UTC');

    expect(anchor.toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(cycleWeekAt({ ...cycle, anchor }, now, 'UTC')).toBe(3);
  });
});

describe('deload week', () => {
  const rows = [
    { id: 'a', targetSets: 4, targetRIR: 2 },
    { id: 'b', targetSets: 1, targetRIR: 4 },
  ];

  it('halves the sets (at least one) and adds reps in reserve (at most 5)', () => {
    expect(deloadPrescription(rows[0]!)).toEqual({ id: 'a', targetSets: 2, targetRIR: 4 });
    expect(deloadPrescription(rows[1]!)).toEqual({ id: 'b', targetSets: 1, targetRIR: 5 });
  });

  it('only changes the deload week', () => {
    expect(prescriptionsForWeek(rows, cycle, 3)).toBe(rows);
    expect(prescriptionsForWeek(rows, cycle, 4)[0]).toMatchObject({ targetSets: 2 });
    expect(prescriptionsForWeek(rows, null, 4)).toBe(rows);
  });
});

describe('programCycle', () => {
  it('reads the program columns and ignores an incomplete cycle', () => {
    expect(
      programCycle({ cycleWeeks: 4, cycleDeloadWeek: null, cycleAnchor: '2026-10-05T00:00:00Z' }),
    ).toEqual({ weeks: 4, deloadWeek: null, anchor: new Date('2026-10-05T00:00:00Z') });
    expect(programCycle({ cycleWeeks: null, cycleDeloadWeek: 4, cycleAnchor: null })).toBeNull();
  });
});

import { z } from 'zod';
import { MAX_CYCLE_WEEKS, MIN_CYCLE_WEEKS } from '@/lib/program-cycle';

const weekNumber = z.number().int().min(1).max(MAX_CYCLE_WEEKS);

export const programInputSchema = z
  .object({
    name: z.string().trim().min(1, 'Name required').max(120, 'Too long'),
    phase: z.string().trim().min(1, 'Phase required').max(60),
    description: z.string().trim().max(2000).optional().nullable(),
    // Absent = unchanged (older clients, MCP).
    scheduleMode: z.enum(['ROTATION', 'FIXED_DAYS']).optional(),
    // Mesocycle (lib/program-cycle). Absent = unchanged, null = no cycle.
    cycleWeeks: z.number().int().min(MIN_CYCLE_WEEKS).max(MAX_CYCLE_WEEKS).nullable().optional(),
    cycleDeloadWeek: weekNumber.nullable().optional(),
    // "I am in week k now": places the cycle on the calendar.
    cycleCurrentWeek: weekNumber.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.cycleWeeks) return;
    if (value.cycleDeloadWeek != null && value.cycleDeloadWeek > value.cycleWeeks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cycleDeloadWeek'],
        message: 'The deload week must be within the cycle.',
      });
    }
    if (value.cycleCurrentWeek != null && value.cycleCurrentWeek > value.cycleWeeks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cycleCurrentWeek'],
        message: 'The current week must be within the cycle.',
      });
    }
  });

export type ProgramInput = z.infer<typeof programInputSchema>;

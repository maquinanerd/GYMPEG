import { z } from 'zod';

// One-tap deload week (issue #112). The duration is fixed server-side
// (lib/deload.ts DELOAD_DURATION_DAYS), so only how it was started is
// accepted: from the recommendation (with the reason kinds the lifter saw) or
// on their own (epic 2.5). Strict: no custom duration or other fields.
export const deloadStartSchema = z
  .object({
    trigger: z.enum(['RECOMMENDED', 'MANUAL']).optional(),
    reasons: z
      .array(z.enum(['stalled-lifts', 'low-readiness', 'long-block']))
      .max(3)
      .optional(),
  })
  .strict();

export type DeloadStartInput = z.infer<typeof deloadStartSchema>;

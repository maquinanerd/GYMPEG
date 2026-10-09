import { z } from 'zod';
import { SetType, type ExerciseCategory } from '@/lib/prisma-client';
import {
  AVG_HR_MAX,
  AVG_HR_MIN,
  MAX_DISTANCE_M,
  MAX_DURATION_SEC,
  MAX_HR_MAX,
  MAX_HR_MIN,
} from '@/lib/cardio';

// RPE 6 to 10 in half steps; null clears it.
export const RPE_VALUES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;
const rpeSchema = z.union([
  z
    .number()
    .min(6)
    .max(10)
    .refine((value) => Number.isInteger(value * 2), 'RPE goes in half steps'),
  z.null(),
]);

export const setInputSchema = z.object({
  exerciseId: z.string().min(1),
  gymEquipmentId: z.string().min(1).nullable().optional(),
  setNumber: z.coerce.number().int().min(1).max(50),
  weight: z.coerce.number().min(0).max(500),
  reps: z.coerce.number().int().min(0).max(100),
  rir: z
    .union([z.coerce.number().int().min(0).max(5), z.null()])
    .optional()
    .nullable(),
  // Cardio fields (issue #133): only valid on CARDIO exercises - the API
  // enforces that with validateSetForCategory below, since the category lives
  // on the exercise row, not in the payload. Bounds: 1 second to 24 hours,
  // 0 to 1000 km.
  durationSec: z
    .union([z.coerce.number().int().min(1).max(MAX_DURATION_SEC), z.null()])
    .optional()
    .nullable(),
  distanceM: z
    .union([z.coerce.number().min(0).max(MAX_DISTANCE_M), z.null()])
    .optional()
    .nullable(),
  // Average heart rate in bpm (issue #152): cardio-only like the fields
  // above, mainly written by the TCX import. 40..250 when present.
  avgHr: z
    .union([z.coerce.number().int().min(AVG_HR_MIN).max(AVG_HR_MAX), z.null()])
    .optional()
    .nullable(),
  // Maximum (peak) heart rate in bpm (issue #203): cardio-only like avgHr,
  // mainly written by the TCX import. 40..250 when present.
  maxHr: z
    .union([z.coerce.number().int().min(MAX_HR_MIN).max(MAX_HR_MAX), z.null()])
    .optional()
    .nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isWarmup: z.boolean().optional().default(false),
  isDropSet: z.boolean().optional().default(false),
  // Offline queue idempotency key (the set's client-side id). Optional so
  // older clients and imports keep working.
  clientMutationId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  // When the set was performed on the device (epoch ms). Bounded server-side.
  performedAt: z.number().int().positive().optional(),
  // Kind of set. Optional: older clients only send isWarmup/isDropSet, and
  // resolveSetType() derives the type from them.
  type: z.nativeEnum(SetType).optional(),
  rpe: rpeSchema.optional(),
});

export type SetInput = z.infer<typeof setInputSchema>;

export const setUpdateSchema = setInputSchema
  .pick({
    weight: true,
    reps: true,
  })
  .extend({
    rir: z.union([z.null(), z.coerce.number().int().min(0).max(5)]),
    rpe: rpeSchema.optional(),
  });

// The stored type and the legacy flags always agree: an explicit type wins,
// otherwise the flags decide (warm-up first, as every reader excludes it).
export function resolveSetType(data: { type?: SetType; isWarmup?: boolean; isDropSet?: boolean }): {
  type: SetType;
  isWarmup: boolean;
  isDropSet: boolean;
} {
  const type: SetType =
    data.type ?? (data.isWarmup ? 'WARMUP' : data.isDropSet ? 'DROP' : 'WORKING');
  return { type, isWarmup: type === 'WARMUP', isDropSet: type === 'DROP' };
}

export type SetUpdateInput = z.infer<typeof setUpdateSchema>;

// Cross-field rule the schema alone cannot express: duration/distance are
// accepted only on CARDIO exercises (so strength data stays clean), and a
// cardio set requires a duration. Returns an error message or null when valid.
export function validateSetForCategory(
  category: ExerciseCategory,
  data: Pick<SetInput, 'durationSec' | 'distanceM' | 'avgHr' | 'maxHr'>,
): string | null {
  if (category === 'CARDIO') {
    if (data.durationSec == null) {
      return 'A cardio set requires a duration.';
    }
    return null;
  }
  if (
    data.durationSec != null ||
    data.distanceM != null ||
    data.avgHr != null ||
    data.maxHr != null
  ) {
    return 'Duration, distance and heart rate are only valid on cardio exercises.';
  }
  return null;
}

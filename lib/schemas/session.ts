import { z } from 'zod';
import { UUID_V7_PATTERN } from '@/lib/uuidv7';

export const sessionStartSchema = z.object({
  workoutId: z.string().min(1),
  gymId: z.string().min(1).optional().nullable(),
  // Id generated on the device (UUIDv7, ADR-004). Makes the start idempotent
  // and lets a session started offline be created later with the same id its
  // queued sets already point to. Optional: older clients let the server pick.
  id: z.string().regex(UUID_V7_PATTERN).optional(),
  // When the session started on the device (epoch ms). Bounded server-side.
  startedAt: z.number().int().positive().optional(),
  // Live start (the lifter just tapped Start, online): an unfinished session
  // on the same workout is resumed instead. The outbox replay of a start made
  // offline never sets it, since its sets already point to `id`.
  resumeOpen: z.boolean().optional(),
});

export const sessionUpdateSchema = z.object({
  notes: z.string().trim().max(2000).optional().nullable(),
  // If true, sets finishedAt (once: a replayed finish keeps the first one).
  finish: z.boolean().optional(),
  // When the lifter finished on the device (epoch ms). Bounded server-side.
  finishedAt: z.number().int().positive().optional(),
});

export type SessionStart = z.infer<typeof sessionStartSchema>;
export type SessionUpdate = z.infer<typeof sessionUpdateSchema>;

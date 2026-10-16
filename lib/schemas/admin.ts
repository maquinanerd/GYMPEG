import { z } from 'zod';
import { PANEL_PROVIDER_IDS } from '@/lib/admin-settings';
import { passwordSchema } from '@/lib/schemas/auth';

export const adminCreateUserSchema = z.object({
  email: z.string().trim().email('Invalid email').max(200),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80).nullable().optional(),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});

export const adminUpdateUserSchema = z
  .object({
    blocked: z.boolean().optional(),
    role: z.enum(['USER', 'ADMIN']).optional(),
  })
  .refine((value) => value.blocked !== undefined || value.role !== undefined, {
    message: 'Nothing to change',
  });

export const adminDeleteUserSchema = z.object({
  confirmEmail: z.string().trim().min(1).max(200),
});

export const adminSetPasswordSchema = z.object({ password: passwordSchema });

export const adminAiTestSchema = z.object({ provider: z.enum(PANEL_PROVIDER_IDS) });

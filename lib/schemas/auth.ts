import { z } from 'zod';

// bcrypt only hashes the first 72 bytes: anything past that would be silently
// ignored, so a longer password is refused instead of half-checked.
export const PASSWORD_MAX_BYTES = 72;

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((value) => new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES, {
    message: 'Password is too long',
  });

export const registerSchema = z.object({
  email: z.string().email('Invalid email').max(200),
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(80).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

import { z } from 'zod';

// Erasing the account asks for the current password and for the account's
// e-mail typed in full: a deliberate act, not a slipped tap.
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200),
  confirmEmail: z.string().trim().min(1).max(254),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

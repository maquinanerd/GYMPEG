import bcrypt from 'bcrypt';

// Cost 12 for every new hash. Existing cost-10 hashes keep verifying (bcrypt
// stores the cost in the hash) and are upgraded on the next password change.
export const BCRYPT_COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

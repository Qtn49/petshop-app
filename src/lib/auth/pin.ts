/**
 * Server-side PIN hashing and verification using bcrypt.
 * Use only in API routes or server code; never expose hashes to the client.
 */
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/** Hash a PIN for storage. PIN must be 4–6 digits. */
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

/** Verify a plain PIN against a stored hash. */
export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}

/** Validate PIN format: 4 to 6 digits. */
export function validatePinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

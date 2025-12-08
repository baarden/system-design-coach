import { randomBytes } from 'crypto';

/**
 * Generate a URL-safe share token.
 * 21 characters, similar to nanoid default length.
 */
export function generateShareToken(): string {
  const bytes = randomBytes(16);
  return bytes.toString('base64url').slice(0, 21);
}

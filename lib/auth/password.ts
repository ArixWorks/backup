import "server-only"
import crypto from "node:crypto"
import argon2 from "argon2"

/**
 * Password hashing with Argon2id (the current OWASP-recommended algorithm).
 *
 * Legacy accounts created before this upgrade were hashed with Node's scrypt
 * (format: `scrypt$<saltHex>$<hashHex>`). Those hashes are still accepted on
 * login and transparently upgraded to Argon2id via `needsRehash` — so existing
 * users never have to reset their password.
 */

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
}

/** Hash a plaintext password with Argon2id. */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS)
}

/** Constant-time verification for legacy scrypt hashes. */
function verifyScrypt(password: string, stored: string): boolean {
  const parts = stored.split("$")
  if (parts.length !== 3 || parts[0] !== "scrypt") return false
  try {
    const salt = Buffer.from(parts[1], "hex")
    const expected = Buffer.from(parts[2], "hex")
    const actual = crypto.scryptSync(password, salt, expected.length || 64)
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/**
 * Verify a password against a stored hash (Argon2id or legacy scrypt).
 * Safe to call with a null/undefined hash (returns false).
 */
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false
  if (stored.startsWith("scrypt$")) return verifyScrypt(password, stored)
  try {
    return await argon2.verify(stored, password)
  } catch {
    return false
  }
}

/**
 * Whether a stored hash should be re-hashed with the current Argon2id params.
 * Returns true for any legacy (scrypt) hash or outdated Argon2 parameters.
 */
export function needsRehash(stored: string | null | undefined): boolean {
  if (!stored) return false
  if (!stored.startsWith("$argon2")) return true
  try {
    return argon2.needsRehash(stored, ARGON2_OPTIONS)
  } catch {
    return true
  }
}

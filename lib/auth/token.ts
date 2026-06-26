import "server-only"
import crypto from "node:crypto"

/**
 * Stateless, signed session tokens (HMAC-SHA256). The token payload is the
 * user id plus an expiry; the signature makes it tamper-proof so a user can no
 * longer impersonate another account by editing the cookie value.
 *
 * Format: base64url(payloadJson) + "." + base64url(hmac)
 */

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

type Payload = { uid: string; exp: number; ver?: number }

/**
 * Resolve the signing secret. Prefers AUTH_SECRET; falls back to deriving a
 * stable key from the bot token so the app keeps working before the user adds
 * a dedicated secret. Throws only if nothing usable exists.
 */
function secret(): string {
  const s =
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.BOT_TOKEN
  if (!s) {
    throw new Error("AUTH_SECRET is not set and no bot token is available to derive a key from")
  }
  return s
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url")
}

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url")
}

/**
 * Create a signed token for a user id, valid for `ttlSeconds`. The `tokenVersion`
 * is embedded so it can be checked against the user's current version on every
 * request — bumping the version invalidates all previously issued sessions.
 */
export function signSession(
  uid: string,
  tokenVersion = 0,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const payload: Payload = {
    uid,
    ver: tokenVersion,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }
  const body = b64url(JSON.stringify(payload))
  return `${body}.${sign(body)}`
}

/**
 * Verify a signed token and return the user id, or null when the token is
 * missing, malformed, tampered with, or expired. Uses a constant-time compare
 * to avoid timing attacks on the signature.
 */
export function verifySession(
  token: string | undefined | null,
): { uid: string; ver: number } | null {
  if (!token || !token.includes(".")) return null
  const [body, sig] = token.split(".")
  if (!body || !sig) return null

  let expected: string
  try {
    expected = sign(body)
  } catch {
    return null
  }
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Payload
    if (!payload?.uid || typeof payload.exp !== "number") return null
    if (payload.exp * 1000 < Date.now()) return null
    return { uid: payload.uid, ver: payload.ver ?? 0 }
  } catch {
    return null
  }
}

export const SESSION_TTL_SECONDS = DEFAULT_TTL_SECONDS

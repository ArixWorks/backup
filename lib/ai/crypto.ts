import "server-only"
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

/**
 * Symmetric encryption for AI provider API keys at rest (AES-256-GCM).
 *
 * The 32-byte key is derived (SHA-256) from `AI_ENCRYPTION_KEY` if set,
 * otherwise from `AUTH_SECRET`. Deriving via a hash lets us accept a secret of
 * any length while always feeding AES a correct 256-bit key. Raw keys never
 * leave the server and are never logged.
 *
 * Payload format (all base64, colon-separated): `iv:authTag:ciphertext`.
 */

const ALGO = "aes-256-gcm"

function encryptionKey(): Buffer {
  const secret = process.env.AI_ENCRYPTION_KEY || process.env.AUTH_SECRET
  if (!secret) {
    throw new Error(
      "AI encryption requires AI_ENCRYPTION_KEY or AUTH_SECRET to be set.",
    )
  }
  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, encryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":")
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted secret payload")
  }
  const decipher = createDecipheriv(ALGO, encryptionKey(), Buffer.from(ivB64, "base64"))
  decipher.setAuthTag(Buffer.from(tagB64, "base64"))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ])
  return dec.toString("utf8")
}

/** Last 4 characters of a raw key, for a non-sensitive "•••• 1234" UI hint. */
export function keyLast4(raw: string): string {
  return raw.slice(-4)
}

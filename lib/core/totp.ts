import "server-only"
import { createHmac } from "node:crypto"

/**
 * RFC 6238 TOTP implementation on top of node:crypto (no third-party deps).
 *
 * Secrets are stored as base32 (the format authenticator apps use, e.g.
 * "JBSWY3DPEHPK3PXP"). We decode to bytes, run RFC 4226 HOTP over the
 * time-counter, and truncate to the configured number of digits.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

/** Decode an RFC 4648 base32 string (case-insensitive, padding/space tolerant). */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "")
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((value >>> bits) & 0xff)
    }
  }
  return Buffer.from(out)
}

/** True when a string is a plausible base32 secret (>= 16 usable chars). */
export function isValidBase32Secret(input: string): boolean {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "")
  return clean.length >= 16
}

type TotpAlgo = "SHA1" | "SHA256" | "SHA512"

export interface TotpConfig {
  secret: string // base32
  digits?: number
  period?: number
  algo?: TotpAlgo
}

/** Generate the TOTP code for a given unix time (defaults to now). */
export function generateTotp(config: TotpConfig, forTimeMs: number = Date.now()): string {
  const digits = config.digits ?? 6
  const period = config.period ?? 30
  const algo = (config.algo ?? "SHA1").toLowerCase()

  const counter = Math.floor(forTimeMs / 1000 / period)
  const counterBuf = Buffer.alloc(8)
  // Write the 64-bit counter big-endian (high 32 bits are ~always 0 for now).
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0)
  counterBuf.writeUInt32BE(counter % 0x100000000, 4)

  const key = base32Decode(config.secret)
  const hmac = createHmac(algo, key).update(counterBuf).digest()

  // Dynamic truncation (RFC 4226 §5.3).
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  const code = binary % 10 ** digits
  return code.toString().padStart(digits, "0")
}

/** Seconds remaining until the current TOTP window rolls over. */
export function secondsRemaining(period = 30, forTimeMs: number = Date.now()): number {
  const elapsed = Math.floor(forTimeMs / 1000) % period
  return period - elapsed
}

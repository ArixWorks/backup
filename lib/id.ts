import { randomBytes, randomUUID } from "crypto"

/** Unguessable URL-safe slug for products/auctions/orders. */
export function secureSlug(prefix = ""): string {
  const token = randomBytes(12).toString("base64url")
  return prefix ? `${prefix}-${token}` : token
}

export function newId(): string {
  return randomUUID()
}

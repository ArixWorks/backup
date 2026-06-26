import "server-only"
import crypto from "node:crypto"
import { cache } from "@/lib/redis"
import { ConflictError } from "@/lib/core/errors"

/**
 * Idempotency guard for state-changing HTTP operations.
 *
 * Prevents a request from executing twice when a client retries, double-clicks,
 * or a network hiccup causes a resend. Two layers:
 *  1. An atomic "claim" marker (setIfAbsent) so only one in-flight execution of
 *     a given key proceeds; concurrent duplicates get a 409.
 *  2. A cached result so a *completed* operation returns its original result on
 *     replay instead of running again.
 *
 * The key is derived from the authenticated user + operation + an
 * `Idempotency-Key` header when present, otherwise a hash of the request
 * payload (collapses accidental double-submits within the window).
 */

const RESULT_PREFIX = "idem:res:"
const CLAIM_PREFIX = "idem:claim:"

/** Build a stable idempotency key for a user-scoped operation. */
export function idempotencyKey(parts: {
  userId: string
  operation: string
  header?: string | null
  payload?: unknown
}): string {
  const basis =
    parts.header?.trim() ||
    crypto
      .createHash("sha256")
      .update(JSON.stringify(parts.payload ?? {}))
      .digest("hex")
      .slice(0, 32)
  return `${parts.operation}:${parts.userId}:${basis}`
}

/** Read the `Idempotency-Key` request header, if any. */
export function readIdempotencyHeader(req: Request): string | null {
  return req.headers.get("idempotency-key") || req.headers.get("x-idempotency-key")
}

export interface WithIdempotencyOptions {
  /** Stable idempotency key (see `idempotencyKey`). */
  key: string
  /** How long to remember the result/claim, in seconds. Default 1 hour. */
  ttlSec?: number
}

/**
 * Run `fn` at most once per key within the TTL window. Returns the original
 * result on replay. Throws `ConflictError` if an identical request is still
 * in flight.
 */
export async function withIdempotency<T>(
  opts: WithIdempotencyOptions,
  fn: () => Promise<T>,
): Promise<T> {
  const ttl = opts.ttlSec ?? 3600
  const resultKey = RESULT_PREFIX + opts.key
  const claimKey = CLAIM_PREFIX + opts.key

  // Replay of a completed operation — return the stored result.
  const cached = await cache.get(resultKey).catch(() => null)
  if (cached) {
    try {
      return JSON.parse(cached) as T
    } catch {
      return cached as unknown as T
    }
  }

  // Claim the key so concurrent duplicates cannot both execute.
  const claimed = await cache.setIfAbsent(claimKey, "1", ttl).catch(() => true)
  if (!claimed) {
    throw new ConflictError("این درخواست در حال پردازش است. لطفاً صبر کنید.")
  }

  try {
    const result = await fn()
    // Persist the result for replay. Best-effort — failure to cache must not
    // fail the (already successful) operation.
    await cache
      .set(resultKey, safeStringify(result), ttl)
      .catch(() => {})
    return result
  } catch (err) {
    // Release the claim so the client can legitimately retry after a failure.
    await cache.del(claimKey).catch(() => {})
    throw err
  }
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
}

import "server-only"
import { cache } from "@/lib/redis"
import { TooManyRequestsError } from "@/lib/core/errors"

/**
 * Distributed fixed-window rate limiting.
 *
 * Backed by `lib/redis` — atomic INCR+EXPIRE when REDIS_URL is set (shared
 * across all instances) and an in-memory counter in dev/preview. Exceeding a
 * limit throws `TooManyRequestsError` (HTTP 429) which the `route()` wrapper
 * serializes with a `Retry-After` header.
 *
 * Keep buckets coarse and identifiers stable (user id or client IP) so an
 * attacker cannot trivially rotate around the limit.
 */

export interface RateLimitOptions {
  /** Logical bucket name, e.g. "auth:login". */
  bucket: string
  /** Stable identifier within the bucket (user id, IP, telegram id, email). */
  identifier: string
  /** Max requests allowed within the window. */
  limit: number
  /** Window length in seconds. */
  windowSec: number
}

export interface RateLimitResult {
  ok: boolean
  remaining: number
  retryAfter: number
}

/** Increment the counter for a bucket/identifier and report the result. */
export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const { bucket, identifier, limit, windowSec } = opts
  const key = `rl:${bucket}:${identifier}`
  let count: number
  try {
    count = await cache.incr(key, windowSec)
  } catch {
    // Fail open on cache errors — never block legitimate traffic because the
    // limiter backend is unavailable. (Abuse is still caught by other layers.)
    return { ok: true, remaining: limit, retryAfter: 0 }
  }
  const remaining = Math.max(0, limit - count)
  return { ok: count <= limit, remaining, retryAfter: count <= limit ? 0 : windowSec }
}

/**
 * Enforce a rate limit, throwing `TooManyRequestsError` when exceeded.
 * Returns the remaining quota when allowed.
 */
export async function enforceRateLimit(
  opts: RateLimitOptions,
  message?: string,
): Promise<number> {
  const res = await checkRateLimit(opts)
  if (!res.ok) throw new TooManyRequestsError(message, res.retryAfter)
  return res.remaining
}

/**
 * Best-effort client IP from proxy headers. Vercel/most proxies set
 * `x-forwarded-for` (comma-separated, client first). Falls back to a constant
 * so the limiter still groups unknown-IP traffic together rather than letting
 * it bypass entirely.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  return (
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  )
}

/**
 * Convenience guard for HTTP routes: rate-limit by client IP.
 * Usage: `await rateLimitByIp(req, { bucket: "auth:login", limit: 10, windowSec: 60 })`
 */
export async function rateLimitByIp(
  req: Request,
  opts: { bucket: string; limit: number; windowSec: number; message?: string },
): Promise<void> {
  await enforceRateLimit(
    { bucket: opts.bucket, identifier: clientIp(req), limit: opts.limit, windowSec: opts.windowSec },
    opts.message,
  )
}

/** Convenience guard: rate-limit by an explicit identifier (e.g. user id). */
export async function rateLimitBy(
  identifier: string,
  opts: { bucket: string; limit: number; windowSec: number; message?: string },
): Promise<void> {
  await enforceRateLimit(
    { bucket: opts.bucket, identifier, limit: opts.limit, windowSec: opts.windowSec },
    opts.message,
  )
}

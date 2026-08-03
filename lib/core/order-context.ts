import type { OrderSource } from "@prisma/client"

/**
 * Purchase context captured best-effort at checkout for fraud review and
 * channel attribution. Every field is optional: a missing value is stored as
 * null and rendered as "unknown" in the admin order-detail view. Capturing
 * this must NEVER be able to fail a purchase, so callers build it with the
 * helpers below (which never throw) and pass it straight into `order.create`.
 */
export interface OrderContext {
  source?: OrderSource | null
  ipAddress?: string | null
  userAgent?: string | null
}

/** Max length we persist for a user-agent string (defensive; UAs are short). */
const MAX_UA = 512

/**
 * Extract the first-hop client IP from an incoming request's headers.
 * Prefers `x-forwarded-for` (first entry = original client), then falls back
 * to `x-real-ip`. Returns null when nothing usable is present.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for")
  if (fwd) {
    const first = fwd.split(",")[0]?.trim()
    if (first) return normalizeIp(first)
  }
  const real = headers.get("x-real-ip")?.trim()
  if (real) return normalizeIp(real)
  return null
}

/** Trim, strip an IPv6-mapped IPv4 prefix, and cap length. */
function normalizeIp(ip: string): string | null {
  let v = ip.trim()
  if (!v) return null
  // ::ffff:1.2.3.4 -> 1.2.3.4
  if (v.startsWith("::ffff:")) v = v.slice("::ffff:".length)
  return v.slice(0, 45) || null
}

/**
 * Resolve the OrderSource for a web/mini-app request. The storefront client
 * sends `x-client-source: mini-app` when running inside Telegram's WebApp;
 * everything else defaults to WEB. Never throws.
 */
export function sourceFromHeaders(headers: Headers): OrderSource {
  const hinted = headers.get("x-client-source")?.trim().toLowerCase()
  if (hinted === "mini-app" || hinted === "miniapp" || hinted === "webapp") {
    return "MINI_APP"
  }
  return "WEB"
}

/**
 * Build an OrderContext from an incoming HTTP request (web + mini-app paths).
 * Best-effort and non-throwing.
 */
export function orderContextFromRequest(req: Request): OrderContext {
  try {
    const ua = req.headers.get("user-agent")?.trim() || null
    return {
      source: sourceFromHeaders(req.headers),
      ipAddress: clientIpFromHeaders(req.headers),
      userAgent: ua ? ua.slice(0, MAX_UA) : null,
    }
  } catch {
    return {}
  }
}

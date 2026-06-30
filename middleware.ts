import { NextResponse, type NextRequest } from "next/server"

/**
 * Edge middleware — global CSRF defense for the API.
 *
 * Every state-changing API request (POST/PUT/PATCH/DELETE) must originate from
 * our own site: we compare the request Origin against the Host. Combined with
 * httpOnly session cookies this blocks cross-site form/script submissions that
 * try to ride a logged-in user's cookies.
 *
 * Exemptions (these authenticate with a shared secret, not session cookies, and
 * are called by external systems that send no Origin header):
 *   - /api/telegram/*  (Telegram servers; webhook verifies a secret token)
 *   - /api/v1/cron/*   (scheduler; verifies a cron secret)
 *
 * Per-route handlers still perform auth, rate limiting and validation — this is
 * defense in depth, not a replacement.
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])

// Path prefixes that are exempt from the same-origin requirement.
const CSRF_EXEMPT_PREFIXES = ["/api/telegram/", "/api/v1/cron/"]

function isExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
}

/**
 * Decide whether a state-changing request originates from a foreign site.
 *
 * Primary signal: the `Sec-Fetch-Site` header. Browsers set it automatically
 * and it is a forbidden header name, so cross-site form/script submissions
 * cannot forge it. Only the literal value "cross-site" is dangerous;
 * "same-origin", "same-site" and "none" (direct navigation) are all legitimate.
 * This works correctly behind reverse proxies / preview iframes where the
 * server's Host header (e.g. localhost:3000) never matches the public Origin.
 *
 * Fallback (legacy clients without Sec-Fetch-Site): compare the Origin/Referer
 * host against our own Host / forwarded host.
 */
function isCrossSiteRequest(req: NextRequest): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site")
  if (secFetchSite) return secFetchSite === "cross-site"

  const source = req.headers.get("origin") || req.headers.get("referer")
  if (!source) return false // no Origin/Referer — rely on SameSite cookie policy

  const allowedHosts = new Set(
    [req.headers.get("host"), req.headers.get("x-forwarded-host")].filter((h): h is string => !!h),
  )
  try {
    return !allowedHosts.has(new URL(source).host)
  } catch {
    return true
  }
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  if (!MUTATING.has(req.method) || isExempt(pathname)) {
    return NextResponse.next()
  }

  if (isCrossSiteRequest(req)) {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: "درخواست از مبدأ نامعتبر" } },
      { status: 403 },
    )
  }

  return NextResponse.next()
}

export const config = {
  // Only run on API routes; page/asset security headers are set in next.config.
  matcher: ["/api/:path*"],
}

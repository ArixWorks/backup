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

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  if (!MUTATING.has(req.method) || isExempt(pathname)) {
    return NextResponse.next()
  }

  const source = req.headers.get("origin") || req.headers.get("referer")

  // Allowed hosts: the direct Host plus any proxy-forwarded host. Behind a
  // reverse proxy / preview iframe the browser's Origin matches the original
  // (forwarded) host, while the server's Host header is the internal one — both
  // are legitimately same-origin, so we accept either.
  const allowedHosts = new Set(
    [req.headers.get("host"), req.headers.get("x-forwarded-host")].filter((h): h is string => !!h),
  )

  // A present Origin/Referer that disagrees with every allowed host is cross-site.
  if (allowedHosts.size > 0 && source) {
    let originHost: string | null = null
    try {
      originHost = new URL(source).host
    } catch {
      originHost = null
    }
    if (!originHost || !allowedHosts.has(originHost)) {
      return NextResponse.json(
        { ok: false, error: { code: "FORBIDDEN", message: "درخواست از مبدأ نامعتبر" } },
        { status: 403 },
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  // Only run on API routes; page/asset security headers are set in next.config.
  matcher: ["/api/:path*"],
}

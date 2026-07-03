import { NextResponse, type NextRequest } from "next/server"

/**
 * Edge proxy (formerly middleware) — global CSRF defense for the API.
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

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  if (!MUTATING.has(req.method) || isExempt(pathname)) {
    return NextResponse.next()
  }

  const host = req.headers.get("host")
  const source = req.headers.get("origin") || req.headers.get("referer")

  // A present Origin/Referer that disagrees with Host is a cross-site request.
  if (host && source) {
    try {
      const url = new URL(source)
      if (url.host !== host) {
        return NextResponse.json(
          { ok: false, error: { code: "FORBIDDEN", message: "درخواست از مبدأ نامعتبر" } },
          { status: 403 },
        )
      }
    } catch {
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

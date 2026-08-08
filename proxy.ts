import { NextResponse, type NextRequest } from "next/server"
import { isAllowedRequestOrigin } from "@/lib/api/origin"

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

// TEMPORARY: master switch for the same-origin CSRF enforcement below.
// Turned OFF on request to unblock sign-in while a production Origin/Host
// mismatch is investigated. Flip back to `true` (or delete this constant and
// its guard) to restore full CSRF protection.
const CSRF_ENFORCEMENT_ENABLED = false

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"])

// Path prefixes that are exempt from the same-origin requirement.
const CSRF_EXEMPT_PREFIXES = ["/api/telegram/", "/api/v1/cron/"]

// In production we require a strict Origin===Host match. Outside production
// (v0 preview, Vercel preview deployments, local dev) the app is rendered
// inside an editor iframe whose Origin legitimately differs from the request
// Host, so platform preview origins are additionally trusted there.
const IS_PRODUCTION = process.env.VERCEL_ENV === "production"

function isExempt(pathname: string): boolean {
  return CSRF_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))
}

function isSameOrigin(sourceHost: string, req: NextRequest): boolean {
  const selfHosts = [req.headers.get("host"), req.headers.get("x-forwarded-host")]
    .filter(Boolean)
    .flatMap((h) => h!.split(",").map((s) => s.trim()))
  return isAllowedRequestOrigin(sourceHost, selfHosts, IS_PRODUCTION)
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  if (!CSRF_ENFORCEMENT_ENABLED || !MUTATING.has(req.method) || isExempt(pathname)) {
    return NextResponse.next()
  }

  const source = req.headers.get("origin") || req.headers.get("referer")

  // A present Origin/Referer that disagrees with our host(s) is cross-site.
  if (source) {
    let sourceHost: string | null = null
    try {
      sourceHost = new URL(source).host
    } catch {
      sourceHost = null
    }
    if (!sourceHost || !isSameOrigin(sourceHost, req)) {
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

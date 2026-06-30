import { ForbiddenError } from "@/lib/core/errors"

/**
 * Lightweight CSRF defense for state-changing requests. We require the request
 * to originate from our own site by comparing the Origin (or Referer) header
 * against the Host. Combined with httpOnly session cookies this blocks
 * cross-site form/script POSTs — important because the Mini App session cookie
 * uses SameSite=None.
 */
export function assertSameOrigin(req: Request): void {
  // Allowed hosts: the direct Host plus any proxy-forwarded host. Behind a
  // reverse proxy / preview iframe the browser's Origin matches the original
  // (forwarded) host while the server's Host header is the internal one — both
  // are legitimately same-origin, so we accept either.
  const allowedHosts = new Set(
    [req.headers.get("host"), req.headers.get("x-forwarded-host")].filter((h): h is string => !!h),
  )
  if (allowedHosts.size === 0) throw new ForbiddenError("درخواست نامعتبر")

  const origin = req.headers.get("origin")
  const referer = req.headers.get("referer")
  const source = origin || referer
  // No Origin/Referer (e.g. some same-origin navigations) — allow, the cookie
  // SameSite policy still applies.
  if (!source) return

  try {
    const url = new URL(source)
    if (!allowedHosts.has(url.host)) throw new ForbiddenError("درخواست از مبدأ نامعتبر")
  } catch {
    throw new ForbiddenError("درخواست از مبدأ نامعتبر")
  }
}

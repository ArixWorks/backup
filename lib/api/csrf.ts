import { ForbiddenError } from "@/lib/core/errors"

/**
 * Lightweight CSRF defense for state-changing requests. We require the request
 * to originate from our own site by comparing the Origin (or Referer) header
 * against the Host. Combined with httpOnly session cookies this blocks
 * cross-site form/script POSTs — important because the Mini App session cookie
 * uses SameSite=None.
 */
export function assertSameOrigin(req: Request): void {
  // Primary signal: the browser-set `Sec-Fetch-Site` header. It is a forbidden
  // header name, so cross-site form/script submissions cannot forge it. Only
  // "cross-site" is dangerous — "same-origin", "same-site" and "none" (direct
  // navigation) are all legitimate. This is correct behind reverse proxies /
  // preview iframes, where the server's Host (e.g. localhost:3000) never
  // matches the public Origin the browser reports.
  const secFetchSite = req.headers.get("sec-fetch-site")
  if (secFetchSite) {
    if (secFetchSite === "cross-site") throw new ForbiddenError("درخواست از مبدأ نامعتبر")
    return
  }

  // Fallback for legacy clients without Sec-Fetch-Site: compare the
  // Origin/Referer host against our own Host / forwarded host.
  const source = req.headers.get("origin") || req.headers.get("referer")
  // No Origin/Referer (e.g. some same-origin navigations) — allow, the cookie
  // SameSite policy still applies.
  if (!source) return

  const allowedHosts = new Set(
    [req.headers.get("host"), req.headers.get("x-forwarded-host")].filter((h): h is string => !!h),
  )
  try {
    const url = new URL(source)
    if (!allowedHosts.has(url.host)) throw new ForbiddenError("درخواست از مبدأ نامعتبر")
  } catch {
    throw new ForbiddenError("درخواست از مبدأ نامعتبر")
  }
}

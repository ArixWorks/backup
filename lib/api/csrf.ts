import { ForbiddenError } from "@/lib/core/errors"

/**
 * Lightweight CSRF defense for state-changing requests. We require the request
 * to originate from our own site by comparing the Origin (or Referer) header
 * against the Host. Combined with httpOnly session cookies this blocks
 * cross-site form/script POSTs — important because the Mini App session cookie
 * uses SameSite=None.
 */
export function assertSameOrigin(req: Request): void {
  const host = req.headers.get("host")
  if (!host) throw new ForbiddenError("درخواست نامعتبر")

  const origin = req.headers.get("origin")
  const referer = req.headers.get("referer")
  const source = origin || referer
  // No Origin/Referer (e.g. some same-origin navigations) — allow, the cookie
  // SameSite policy still applies.
  if (!source) return

  try {
    const url = new URL(source)
    if (url.host !== host) throw new ForbiddenError("درخواست از مبدأ نامعتبر")
  } catch {
    throw new ForbiddenError("درخواست از مبدأ نامعتبر")
  }
}

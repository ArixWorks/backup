import { ForbiddenError } from "@/lib/core/errors"
import { isAllowedRequestOrigin } from "@/lib/api/origin"

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

  let sourceHost: string
  try {
    sourceHost = new URL(source).host
  } catch {
    throw new ForbiddenError("درخواست از مبدأ نامعتبر")
  }

  // Same rule as the edge proxy, so a request is not accepted globally and then
  // rejected here (which previously broke these routes in the editor preview,
  // whose Origin is legitimately not our Host).
  const selfHosts = [host, req.headers.get("x-forwarded-host")]
    .filter(Boolean)
    .flatMap((h) => h!.split(",").map((s) => s.trim()))
  if (!isAllowedRequestOrigin(sourceHost, selfHosts, process.env.VERCEL_ENV === "production")) {
    throw new ForbiddenError("درخواست از مبدأ نامعتبر")
  }
}

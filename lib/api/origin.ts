/**
 * Same-origin decision for the API's CSRF defense, kept pure so it can be
 * tested without an edge request. `proxy.ts` supplies the real headers.
 */

/**
 * Editor/preview hosts trusted OUTSIDE production only. Each entry matches the
 * apex itself as well as any subdomain of it: the app may be embedded under a
 * generated subdomain (`preview-x.v0.app`) or served straight from the apex
 * (`v0.app`). A leading-dot suffix test alone rejects the apex, which surfaces
 * to the user as "you do not have permission" when signing in from the preview.
 */
const PREVIEW_ORIGIN_HOSTS = ["vusercontent.net", "v0.app", "v0.dev", "vercel.app"]

const LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "[::1]"]

/** Strips the port so an origin on a non-default port still compares equal. */
function bareHost(host: string): string {
  // Bracketed IPv6 literals keep their brackets; only a trailing :port is cut.
  const match = /^(\[[^\]]+\]|[^:]+)(?::\d+)?$/.exec(host.trim().toLowerCase())
  return match ? match[1] : host.trim().toLowerCase()
}

/**
 * True when `host` is exactly `domain` or a subdomain of it. Compared on a label
 * boundary so a lookalike registration such as `fakev0.app` cannot pass as
 * `v0.app`, which a plain substring or suffix check would wrongly accept.
 */
function isHostOrSubdomainOf(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

export function isTrustedPreviewHost(host: string): boolean {
  const bare = bareHost(host)
  return (
    PREVIEW_ORIGIN_HOSTS.some((domain) => isHostOrSubdomainOf(bare, domain)) || LOOPBACK_HOSTS.includes(bare)
  )
}

/**
 * Decides whether a mutating request's Origin/Referer host may act on this app.
 *
 * @param sourceHost host parsed from the request's Origin or Referer
 * @param selfHosts  our own host(s), from `host` and `x-forwarded-host`
 * @param isProduction in production ONLY an exact self-host match is accepted
 */
export function isAllowedRequestOrigin(sourceHost: string, selfHosts: string[], isProduction: boolean): boolean {
  const bare = bareHost(sourceHost)
  if (!bare) return false

  // Behind a proxy the browser-facing host arrives as `x-forwarded-host` while
  // `host` may be an internal address, so a match against either counts.
  if (selfHosts.some((self) => bareHost(self) === bare)) return true

  return isProduction ? false : isTrustedPreviewHost(bare)
}

import type { DomainAvailabilityStatus } from "@prisma/client"

export interface RailwayDomainInfo {
  domain: string
  zone?: string
  purchasable?: boolean
  purchasePrice?: number
  /**
   * Railway sets this for aftermarket/registry-premium listings. Such a domain
   * is `purchasable: true` while being someone else's property offered for
   * resale, so it must never be treated as a normal free registration.
   */
  premium?: boolean
}

export interface ParsedRailwayResult {
  status: DomainAvailabilityStatus
  providerCode: string
  meta: Record<string, unknown>
}

const domainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function parseRailwayDomainMessage(
  payload: unknown,
  requestedDomains: ReadonlySet<string>,
): Map<string, ParsedRailwayResult> | null {
  if (!payload || typeof payload !== "object") return null
  const message = payload as { type?: unknown; domains?: unknown }
  if (message.type !== "domains" || !message.domains || typeof message.domains !== "object" || Array.isArray(message.domains)) {
    return null
  }

  const results = new Map<string, ParsedRailwayResult>()
  for (const [key, rawValue] of Object.entries(message.domains as Record<string, unknown>)) {
    const domain = key.trim().toLowerCase()
    if (!requestedDomains.has(domain) || !domainPattern.test(domain) || !rawValue || typeof rawValue !== "object") continue

    const info = rawValue as RailwayDomainInfo
    if (typeof info.domain !== "string" || info.domain.trim().toLowerCase() !== domain || typeof info.purchasable !== "boolean") {
      continue
    }

    if (info.purchasable) {
      if (typeof info.purchasePrice !== "number" || !Number.isFinite(info.purchasePrice) || info.purchasePrice <= 0) continue
      const zone = typeof info.zone === "string" ? info.zone : undefined
      // Provider cost travels with the result so the caller can compare it
      // against the TLD's standard synced cost. Without it, a premium listing is
      // indistinguishable from a normal registration once the flag is dropped.
      const providerPriceUsdCents = Math.round(info.purchasePrice * 100)

      // An aftermarket listing is `purchasable` but is not a registration we can
      // fulfil at the flat per-TLD price: hostiva.com came back as purchasable
      // at $30,925.80 and was sold for the standard .com price of 1,141,000 IRT.
      if (info.premium === true) {
        results.set(domain, {
          status: "PREMIUM",
          providerCode: "PREMIUM",
          meta: { zone, providerPriceUsdCents, premium: true },
        })
        continue
      }

      results.set(domain, {
        status: "AVAILABLE",
        providerCode: "PURCHASABLE",
        meta: { zone, hasProviderPrice: true, providerPriceUsdCents },
      })
    } else {
      results.set(domain, {
        status: "REGISTERED",
        providerCode: "TAKEN",
        meta: { zone: typeof info.zone === "string" ? info.zone : undefined },
      })
    }
  }

  return results
}

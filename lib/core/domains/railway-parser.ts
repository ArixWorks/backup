import type { DomainAvailabilityStatus } from "@prisma/client"

export interface RailwayDomainInfo {
  domain: string
  zone?: string
  purchasable?: boolean
  purchasePrice?: number
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
      results.set(domain, {
        status: "AVAILABLE",
        providerCode: "PURCHASABLE",
        meta: { zone: typeof info.zone === "string" ? info.zone : undefined, hasProviderPrice: true },
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

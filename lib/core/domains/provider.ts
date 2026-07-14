import "server-only"
import type { DomainAvailabilityStatus } from "@prisma/client"

export interface AvailabilityResult {
  status: DomainAvailabilityStatus
  provider: string
  providerCode?: string
  meta?: Record<string, unknown>
}

/**
 * Provider adapter for availability only. Cloudflare's RDAP endpoint is used as
 * the production-safe default: 404 means no registration record exists; 200
 * means the domain is registered. Purchase fulfillment stays behind the same
 * adapter boundary so a registrar can be connected without changing orders.
 */
export async function lookupWithProvider(
  asciiDomain: string,
  signal?: AbortSignal,
): Promise<AvailabilityResult> {
  const provider = "cloudflare-rdap"
  try {
    const response = await fetch(`https://rdap.cloudflare.com/v1/domain/${encodeURIComponent(asciiDomain)}`, {
      method: "GET",
      headers: { accept: "application/rdap+json, application/json" },
      cache: "no-store",
      signal: signal ?? AbortSignal.timeout(7000),
    })

    if (response.status === 404) return { status: "AVAILABLE", provider, providerCode: "404" }
    if (response.ok) return { status: "REGISTERED", provider, providerCode: String(response.status) }
    if (response.status === 429) return { status: "LOOKUP_ERROR", provider, providerCode: "RATE_LIMITED" }
    return { status: "UNKNOWN", provider, providerCode: String(response.status) }
  } catch (error) {
    return {
      status: "LOOKUP_ERROR",
      provider,
      providerCode: error instanceof Error ? error.name : "NETWORK_ERROR",
    }
  }
}

export interface RegistrationResult {
  ok: boolean
  providerReference?: string
  expiresAt?: Date
  errorCode?: string
}

export async function registerWithProvider(_asciiDomain: string): Promise<RegistrationResult> {
  // Safe-by-default: availability lookup is live, but fulfillment cannot report
  // success until a registrar implementation and credentials are configured.
  return { ok: false, errorCode: "REGISTRAR_NOT_CONFIGURED" }
}

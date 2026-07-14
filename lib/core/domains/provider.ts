import "server-only"
import type { DomainAvailabilityStatus } from "@prisma/client"
import WebSocket from "ws"
import { parseRailwayDomainMessage, type ParsedRailwayResult } from "./railway-parser"

export interface AvailabilityResult {
  status: DomainAvailabilityStatus
  provider: string
  providerCode?: string
  meta?: Record<string, unknown>
}

const PROVIDER = "railway-domains"
const RAILWAY_SOCKET_URL = "wss://backboard.railway.com/domain-search"
const LOOKUP_TIMEOUT_MS = 8_000
const MAX_MESSAGE_BYTES = 256_000
const MAX_BATCH_SIZE = 50

function unavailable(providerCode: string): AvailabilityResult {
  return { status: "LOOKUP_ERROR", provider: PROVIDER, providerCode }
}

export async function lookupManyWithProvider(
  asciiDomains: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, AvailabilityResult>> {
  const domains = [...new Set(asciiDomains.map((domain) => domain.trim().toLowerCase()))]
  if (domains.length === 0 || domains.length > MAX_BATCH_SIZE) {
    return new Map(domains.map((domain) => [domain, unavailable("INVALID_BATCH")]))
  }

  const requested = new Set(domains)
  const failures = (code: string) => new Map(domains.map((domain) => [domain, unavailable(code)]))

  return new Promise((resolve) => {
    let settled = false
    const socket = new WebSocket(RAILWAY_SOCKET_URL, {
      handshakeTimeout: LOOKUP_TIMEOUT_MS,
      maxPayload: MAX_MESSAGE_BYTES,
      headers: { Origin: "https://railway.com", "User-Agent": "Acciran-Domain-Availability/1.0" },
    })

    const finish = (result: Map<string, AvailabilityResult>) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      socket.removeAllListeners()
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.terminate()
      resolve(result)
    }

    const onAbort = () => finish(failures("ABORTED"))
    const timer = setTimeout(() => finish(failures("TIMEOUT")), LOOKUP_TIMEOUT_MS)
    signal?.addEventListener("abort", onAbort, { once: true })
    if (signal?.aborted) return onAbort()

    socket.once("open", () => {
      socket.send(JSON.stringify({ type: "check", domains, query: domains.join(",") }))
    })
    socket.on("message", (data) => {
      const text = data.toString()
      if (Buffer.byteLength(text) > MAX_MESSAGE_BYTES) return finish(failures("RESPONSE_TOO_LARGE"))
      try {
        const parsed = parseRailwayDomainMessage(JSON.parse(text), requested)
        if (!parsed) return
        const complete = new Map<string, AvailabilityResult>()
        for (const domain of domains) {
          const result: ParsedRailwayResult | undefined = parsed.get(domain)
          complete.set(domain, result
            ? { ...result, provider: PROVIDER }
            : unavailable("MISSING_RESULT"))
        }
        finish(complete)
      } catch {
        finish(failures("MALFORMED_RESPONSE"))
      }
    })
    socket.once("error", () => finish(failures("NETWORK_ERROR")))
    socket.once("close", () => finish(failures("CONNECTION_CLOSED")))
  })
}

export async function lookupWithProvider(
  asciiDomain: string,
  signal?: AbortSignal,
): Promise<AvailabilityResult> {
  const results = await lookupManyWithProvider([asciiDomain], signal)
  return results.get(asciiDomain.trim().toLowerCase()) ?? unavailable("MISSING_RESULT")
}

export interface RegistrationResult {
  ok: boolean
  providerReference?: string
  expiresAt?: Date
  errorCode?: string
}

export async function registerWithProvider(_asciiDomain: string): Promise<RegistrationResult> {
  return { ok: false, errorCode: "REGISTRAR_NOT_CONFIGURED" }
}

import "server-only"
import WebSocket from "ws"

/**
 * Bulk TLD price discovery against Railway's domain-search socket.
 *
 * Verified protocol (measured against the live service):
 *   -> {"type":"search","query":"<probe>"}
 *   <- {"type":"results","domains":[ {domain, zone, purchasable}, ... ]}   // ARRAY, no prices
 *   -> {"type":"check","domains":[ ...up to ~40 full names ]}
 *   <- {"type":"domains","domains":{ "<name>": {..., purchasePrice, renewalPrice} }}  // KEYED, priced
 *
 * The two payload shapes genuinely differ: `search` returns an array and omits
 * prices, `check` returns an object keyed by domain name and includes them. The
 * web UI only issues `check` for rows scrolled into view, which is why prices
 * appear to "load as you scroll" — there is no HTTP price endpoint at all.
 *
 * `purchasePrice` is in DOLLARS (e.g. `11.7`), not cents.
 *
 * Results must be keyed by `item.domain`. Keying by array index instead makes
 * later batches overwrite earlier ones, which silently collapses ~460 results
 * down to the size of one batch.
 */

const SOCKET_URL = "wss://backboard.railway.com/domain-search"
const ORIGIN = "https://railway.com"
const USER_AGENT = "Acciran-Domain-Pricing/1.0"

const MAX_MESSAGE_BYTES = 4_000_000
const HANDSHAKE_TIMEOUT_MS = 12_000
const DISCOVERY_TIMEOUT_MS = 20_000
const PRICE_TIMEOUT_MS = 30_000

/** Matches the batch size the real web client uses. */
export const PRICE_BATCH_SIZE = 40

/** Politeness gap between batches so a run doesn't look like a flood. */
const BATCH_DELAY_MS = 250

/** Hard ceiling so a runaway response can never spin forever. */
const MAX_BATCHES_PER_CALL = 12

export interface DiscoveredZone {
  /** Full probe domain, e.g. `safoaghkgoasfgakas.com` — what `check` expects. */
  domain: string
  /** Bare zone, e.g. `com`. */
  zone: string
}

export interface ZonePrice {
  zone: string
  domain: string
  costCents: number
  purchasable: boolean
}

function socketHeaders() {
  return { Origin: ORIGIN, "User-Agent": USER_AGENT }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

/** Zones must look like real TLD labels; guards against junk entering the catalog. */
const zonePattern = /^[a-z0-9](?:[a-z0-9-]{0,40}[a-z0-9])?(?:\.[a-z]{2,20})?$/

function readZoneItem(raw: unknown): DiscoveredZone | null {
  if (!isPlainObject(raw)) return null
  const domain = typeof raw.domain === "string" ? raw.domain.trim().toLowerCase() : ""
  const zone = typeof raw.zone === "string" ? raw.zone.trim().toLowerCase() : ""
  if (!domain || !zone || !zonePattern.test(zone)) return null
  if (!domain.endsWith(`.${zone}`)) return null
  return { domain, zone }
}

/**
 * One `search` round trip -> every zone the provider offers for that probe.
 * The probe should be a long nonsense label so almost every zone comes back
 * free, which is what makes the result usable as a price catalog.
 */
export function discoverZones(probeQuery: string, signal?: AbortSignal): Promise<DiscoveredZone[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(SOCKET_URL, {
      handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
      maxPayload: MAX_MESSAGE_BYTES,
      headers: socketHeaders(),
    })

    let settled = false
    const finish = (error: Error | null, value?: DiscoveredZone[]) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      socket.removeAllListeners()
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.terminate()
      }
      if (error) reject(error)
      else resolve(value ?? [])
    }

    const onAbort = () => finish(new Error("DISCOVERY_ABORTED"))
    const timer = setTimeout(() => finish(new Error("DISCOVERY_TIMEOUT")), DISCOVERY_TIMEOUT_MS)
    signal?.addEventListener("abort", onAbort, { once: true })
    if (signal?.aborted) return onAbort()

    socket.once("open", () => socket.send(JSON.stringify({ type: "search", query: probeQuery })))

    socket.on("message", (data) => {
      let payload: unknown
      try {
        payload = JSON.parse(data.toString())
      } catch {
        return
      }
      if (!isPlainObject(payload)) return
      // `search` replies with type "results" and an array of zones.
      const list = payload.domains
      if (!Array.isArray(list)) return

      const seen = new Map<string, DiscoveredZone>()
      for (const raw of list) {
        const item = readZoneItem(raw)
        if (item && !seen.has(item.zone)) seen.set(item.zone, item)
      }
      if (seen.size === 0) return
      finish(null, [...seen.values()])
    })

    socket.once("error", () => finish(new Error("DISCOVERY_NETWORK_ERROR")))
    socket.once("close", () => finish(new Error("DISCOVERY_CLOSED_EARLY")))
  })
}

/**
 * Fetch provider prices for a set of probe domains over a single socket.
 *
 * Resolves as soon as every requested name has answered, or on timeout with
 * whatever arrived — a partial result is still useful, and the caller only ever
 * creates/updates rows, so a short read degrades to "fewer updates" rather than
 * a corrupted catalog.
 */
export function fetchZonePrices(
  zones: readonly DiscoveredZone[],
  signal?: AbortSignal,
): Promise<Map<string, ZonePrice>> {
  const wanted = new Map(zones.map((z) => [z.domain, z.zone]))
  if (wanted.size === 0) return Promise.resolve(new Map())

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(SOCKET_URL, {
      handshakeTimeout: HANDSHAKE_TIMEOUT_MS,
      maxPayload: MAX_MESSAGE_BYTES,
      headers: socketHeaders(),
    })

    const found = new Map<string, ZonePrice>()
    const answered = new Set<string>()
    const pending: NodeJS.Timeout[] = []
    let settled = false

    const finish = (error: Error | null) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      pending.forEach(clearTimeout)
      signal?.removeEventListener("abort", onAbort)
      socket.removeAllListeners()
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.terminate()
      }
      // A closed/errored socket still resolves with partial data when we already
      // have some; only a total failure rejects.
      if (error && found.size === 0) reject(error)
      else resolve(found)
    }

    const onAbort = () => finish(new Error("PRICE_ABORTED"))
    const timer = setTimeout(() => finish(null), PRICE_TIMEOUT_MS)
    signal?.addEventListener("abort", onAbort, { once: true })
    if (signal?.aborted) return onAbort()

    socket.once("open", () => {
      const names = [...wanted.keys()]
      const batches: string[][] = []
      for (let i = 0; i < names.length; i += PRICE_BATCH_SIZE) {
        batches.push(names.slice(i, i + PRICE_BATCH_SIZE))
      }
      if (batches.length > MAX_BATCHES_PER_CALL) {
        return finish(new Error("TOO_MANY_BATCHES"))
      }
      batches.forEach((batch, index) => {
        const handle = setTimeout(() => {
          if (settled || socket.readyState !== WebSocket.OPEN) return
          socket.send(JSON.stringify({ type: "check", domains: batch }))
        }, index * BATCH_DELAY_MS)
        pending.push(handle)
      })
    })

    socket.on("message", (data) => {
      let payload: unknown
      try {
        payload = JSON.parse(data.toString())
      } catch {
        return
      }
      if (!isPlainObject(payload)) return

      // `check` replies keyed by domain name. Tolerate the array form too, so a
      // provider-side shape change degrades instead of returning nothing.
      const container = payload.domains
      const items: unknown[] = Array.isArray(container)
        ? container
        : isPlainObject(container)
          ? Object.values(container)
          : []
      if (items.length === 0) return

      for (const raw of items) {
        if (!isPlainObject(raw)) continue
        const domain = typeof raw.domain === "string" ? raw.domain.trim().toLowerCase() : ""
        const zone = wanted.get(domain)
        if (!zone) continue

        const purchasable = raw.purchasable === true
        const price = raw.purchasePrice
        // Only a positive finite price is usable. Zones without one are left out
        // entirely rather than stored as 0, which would look like a free domain.
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
          answered.add(domain)
          continue
        }
        answered.add(domain)
        found.set(zone, {
          zone,
          domain,
          costCents: Math.round(price * 100),
          purchasable,
        })
      }

      if (answered.size >= wanted.size) finish(null)
    })

    socket.once("error", () => finish(new Error("PRICE_NETWORK_ERROR")))
    socket.once("close", () => finish(new Error("PRICE_CLOSED_EARLY")))
  })
}

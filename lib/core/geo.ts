import { cache } from "@/lib/redis"

/**
 * Coarse IP geolocation for the admin fraud-review view. Backed by the free
 * ip-api.com endpoint (no API key, rate-limited to ~45 req/min from one IP),
 * with a long Redis cache so a given IP is looked up at most once per month.
 *
 * Every path is fail-safe: a network error, timeout, rate-limit, private IP,
 * or malformed response resolves to `null`. Geolocation is a nice-to-have
 * signal and must never break the admin page or leak an exception.
 */
export interface GeoInfo {
  country: string | null
  countryCode: string | null
  region: string | null
  city: string | null
  isp: string | null
  /** True when ip-api flags the address as proxy/VPN/hosting (fraud signal). */
  proxy: boolean
  hosting: boolean
}

const CACHE_PREFIX = "geo:v1:"
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const LOOKUP_TIMEOUT_MS = 3000

/** Private / reserved ranges we never bother looking up (always local). */
function isPrivateIp(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd")) return true
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true
  // 172.16.0.0 – 172.31.255.255
  const m = ip.match(/^172\.(\d+)\./)
  if (m) {
    const second = Number(m[1])
    if (second >= 16 && second <= 31) return true
  }
  // link-local + CGNAT
  if (ip.startsWith("169.254.") || ip.startsWith("100.64.")) return true
  return false
}

/**
 * Resolve an IP to a coarse location. Returns null for missing/private IPs or
 * on any failure. Results are cached in Redis for 30 days.
 */
export async function lookupIp(ip: string | null | undefined): Promise<GeoInfo | null> {
  if (!ip) return null
  const clean = ip.trim()
  if (!clean || isPrivateIp(clean)) return null

  const cacheKey = CACHE_PREFIX + clean
  try {
    const cached = await cache.get(cacheKey)
    if (cached) return JSON.parse(cached) as GeoInfo
  } catch {
    // cache miss / parse error — fall through to a live lookup
  }

  const info = await fetchGeo(clean)
  if (info) {
    try {
      await cache.set(cacheKey, JSON.stringify(info), CACHE_TTL_SECONDS)
    } catch {
      // caching is best-effort; ignore write failures
    }
  }
  return info
}

/** Single live ip-api.com request with a hard timeout. Never throws. */
async function fetchGeo(ip: string): Promise<GeoInfo | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
  try {
    // `fields` is a bitmask selecting exactly the columns we render.
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,isp,proxy,hosting`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    if (data.status !== "success") return null
    return {
      country: str(data.country),
      countryCode: str(data.countryCode),
      region: str(data.regionName),
      city: str(data.city),
      isp: str(data.isp),
      proxy: data.proxy === true,
      hosting: data.hosting === true,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null
}

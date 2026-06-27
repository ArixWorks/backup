import "server-only"
import { prisma } from "@/lib/db"
import { cache } from "@/lib/redis"

/**
 * Metric recording & querying.
 *
 * - `recordMetric` / `recordMany` persist samples to `MetricSample`.
 * - In-process counters (RPS, error rate) are kept in `cache` (Redis or memory)
 *   so they survive across requests within a window and across instances when
 *   Redis is present.
 * - `getSeries` / `getLatest` power the dashboard charts and KPIs.
 */

export type MetricInput = { name: string; value: number; labels?: Record<string, unknown> }

const isFiniteNum = (v: number) => typeof v === "number" && Number.isFinite(v)

export async function recordMetric(name: string, value: number, labels?: Record<string, unknown>) {
  if (!isFiniteNum(value)) return
  try {
    await prisma.metricSample.create({
      data: { name, value, labels: labels ? (labels as object) : undefined },
    })
  } catch (e) {
    console.log("[v0] recordMetric error:", (e as Error).message)
  }
}

export async function recordMany(samples: MetricInput[]) {
  const rows = samples
    .filter((s) => isFiniteNum(s.value))
    .map((s) => ({ name: s.name, value: s.value, labels: s.labels ? (s.labels as object) : undefined }))
  if (rows.length === 0) return
  try {
    await prisma.metricSample.createMany({ data: rows })
  } catch (e) {
    console.log("[v0] recordMany error:", (e as Error).message)
  }
}

export type SeriesPoint = { t: string; value: number }

/**
 * Aggregate samples for a metric into evenly spaced buckets (averaged).
 * `rangeMs` = how far back to look, `stepMs` = bucket width.
 */
export async function getSeries(
  name: string,
  rangeMs: number,
  stepMs: number,
): Promise<SeriesPoint[]> {
  const since = new Date(Date.now() - rangeMs)
  const rows = await prisma.metricSample.findMany({
    where: { name, capturedAt: { gte: since } },
    select: { value: true, capturedAt: true },
    orderBy: { capturedAt: "asc" },
  })
  if (rows.length === 0) return []

  const buckets = new Map<number, { sum: number; n: number }>()
  for (const r of rows) {
    const bucket = Math.floor(r.capturedAt.getTime() / stepMs) * stepMs
    const b = buckets.get(bucket) ?? { sum: 0, n: 0 }
    b.sum += r.value
    b.n += 1
    buckets.set(bucket, b)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, b]) => ({ t: new Date(t).toISOString(), value: b.sum / b.n }))
}

export async function getLatest(name: string): Promise<number | null> {
  const row = await prisma.metricSample.findFirst({
    where: { name },
    select: { value: true },
    orderBy: { capturedAt: "desc" },
  })
  return row?.value ?? null
}

/** Latest value for many metrics at once (one query). */
export async function getLatestMany(names: string[]): Promise<Record<string, number | null>> {
  const since = new Date(Date.now() - 10 * 60_000) // look back 10m for "latest"
  const rows = await prisma.metricSample.findMany({
    where: { name: { in: names }, capturedAt: { gte: since } },
    select: { name: true, value: true, capturedAt: true },
    orderBy: { capturedAt: "desc" },
  })
  const out: Record<string, number | null> = Object.fromEntries(names.map((n) => [n, null]))
  for (const r of rows) {
    if (out[r.name] == null) out[r.name] = r.value
  }
  return out
}

// ---------------------------------------------------------------------------
// In-process request counters (for RPS + error rate).
// ---------------------------------------------------------------------------

const WINDOW_SECONDS = 60

function windowKey(suffix: string): string {
  const bucket = Math.floor(Date.now() / 1000 / WINDOW_SECONDS)
  return `ops:counter:${suffix}:${bucket}`
}

/**
 * Increment request + (optionally) error counters and accumulate latency.
 * `route`/`status` are accepted for call-site clarity and future per-route
 * breakdowns; the window counters themselves stay low-cardinality.
 */
export async function recordRequest(input: {
  ok: boolean
  ms?: number
  route?: string
  status?: number
}) {
  const { ok, ms } = input
  try {
    await cache.incr(windowKey("req"), WINDOW_SECONDS * 2)
    if (!ok) await cache.incr(windowKey("err"), WINDOW_SECONDS * 2)
    if (ms != null && isFiniteNum(ms)) {
      await cache.incr(windowKey("latsum"), WINDOW_SECONDS * 2) // count
      // store cumulative latency in a parallel key (ms, integer)
      const k = windowKey("latms")
      const cur = Number((await cache.get(k)) ?? "0")
      await cache.set(k, String(Math.round(cur + ms)), WINDOW_SECONDS * 2)
      // Maintain a capped reservoir of recent latencies so we can compute real
      // percentiles (p50/p95). Best-effort: a racy read-modify-write is fine for
      // a sampled latency distribution.
      const rk = windowKey("latres")
      const raw = (await cache.get(rk)) ?? ""
      const arr = raw ? raw.split(",") : []
      arr.push(String(Math.round(ms)))
      // keep the most recent LAT_RESERVOIR_MAX samples
      const trimmed = arr.length > LAT_RESERVOIR_MAX ? arr.slice(arr.length - LAT_RESERVOIR_MAX) : arr
      await cache.set(rk, trimmed.join(","), WINDOW_SECONDS * 2)
    }
  } catch {
    // counters are best-effort
  }
}

const LAT_RESERVOIR_MAX = 500

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

/** Compute real p50/p95 latency (ms) from the current window's reservoir. */
export async function readLatencyPercentiles(): Promise<{ p50: number; p95: number; count: number }> {
  try {
    const raw = (await cache.get(windowKey("latres"))) ?? ""
    const nums = raw
      .split(",")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b)
    return { p50: percentile(nums, 50), p95: percentile(nums, 95), count: nums.length }
  } catch {
    return { p50: 0, p95: 0, count: 0 }
  }
}

// ---------------------------------------------------------------------------
// Online presence (real active users / sessions over a rolling window).
// ---------------------------------------------------------------------------

const PRESENCE_WINDOW_SECONDS = 300 // 5 minutes
const PRESENCE_MAX_ENTRIES = 5000

function presenceKey(offset = 0): string {
  const bucket = Math.floor(Date.now() / 1000 / PRESENCE_WINDOW_SECONDS) - offset
  return `ops:presence:${bucket}`
}

/**
 * Record genuine online presence from an authenticated request. Distinct
 * `userId`s and `sessionId`s seen within the rolling window are counted as
 * online users / active sessions. Best-effort and fire-and-forget.
 */
export async function recordPresence(userId: string, sessionId?: string | null): Promise<void> {
  try {
    const k = presenceKey()
    const raw = await cache.get(k)
    const map: { u: Record<string, number>; s: Record<string, number> } = raw
      ? JSON.parse(raw)
      : { u: {}, s: {} }
    const now = Date.now()
    map.u[userId] = now
    if (sessionId) map.s[sessionId] = now
    // Guard against unbounded growth under extreme load.
    if (Object.keys(map.u).length <= PRESENCE_MAX_ENTRIES) {
      await cache.set(k, JSON.stringify(map), PRESENCE_WINDOW_SECONDS * 2)
    }
  } catch {
    // best-effort
  }
}

/** Read distinct online users / active sessions across the current + prior window. */
export async function readPresence(): Promise<{ users: number; sessions: number }> {
  try {
    const [curRaw, prevRaw] = await Promise.all([cache.get(presenceKey(0)), cache.get(presenceKey(1))])
    const users = new Set<string>()
    const sessions = new Set<string>()
    for (const raw of [curRaw, prevRaw]) {
      if (!raw) continue
      const map = JSON.parse(raw) as { u?: Record<string, number>; s?: Record<string, number> }
      for (const id of Object.keys(map.u ?? {})) users.add(id)
      for (const id of Object.keys(map.s ?? {})) sessions.add(id)
    }
    return { users: users.size, sessions: sessions.size }
  } catch {
    return { users: 0, sessions: 0 }
  }
}

/** Read the current request window: requests, errors, rps, error rate, avg latency. */
export async function readRequestWindow(): Promise<{
  requests: number
  errors: number
  rps: number
  errorRate: number
  avgLatencyMs: number
}> {
  try {
    const [reqStr, errStr, latCountStr, latSumStr] = await Promise.all([
      cache.get(windowKey("req")),
      cache.get(windowKey("err")),
      cache.get(windowKey("latsum")),
      cache.get(windowKey("latms")),
    ])
    const requests = Number(reqStr ?? "0")
    const errors = Number(errStr ?? "0")
    const latCount = Number(latCountStr ?? "0")
    const latSum = Number(latSumStr ?? "0")
    return {
      requests,
      errors,
      rps: requests / WINDOW_SECONDS,
      errorRate: requests > 0 ? (errors / requests) * 100 : 0,
      avgLatencyMs: latCount > 0 ? latSum / latCount : 0,
    }
  } catch {
    return { requests: 0, errors: 0, rps: 0, errorRate: 0, avgLatencyMs: 0 }
  }
}

/** Track cache hit/miss to compute a real hit ratio. */
export async function recordCacheAccess(hit: boolean) {
  try {
    await cache.incr(windowKey(hit ? "cache_hit" : "cache_miss"), WINDOW_SECONDS * 2)
  } catch {
    // best-effort
  }
}

export async function readCacheHitRatio(): Promise<number | null> {
  try {
    const [hitStr, missStr] = await Promise.all([
      cache.get(windowKey("cache_hit")),
      cache.get(windowKey("cache_miss")),
    ])
    const hit = Number(hitStr ?? "0")
    const miss = Number(missStr ?? "0")
    const total = hit + miss
    if (total === 0) return null
    return (hit / total) * 100
  } catch {
    return null
  }
}

/** Delete metric samples older than `days` to keep the table compact. */
export async function pruneOldMetrics(days = 7): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000)
  try {
    const res = await prisma.metricSample.deleteMany({ where: { capturedAt: { lt: cutoff } } })
    return res.count
  } catch {
    return 0
  }
}

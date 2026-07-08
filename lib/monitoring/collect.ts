import "server-only"
import { getSystemSnapshot } from "./system"
import {
  recordMany,
  readRequestWindow,
  readLatencyPercentiles,
  readCacheHitRatio,
  readPresence,
  pruneOldMetrics,
  type MetricInput,
} from "./metrics"
import { getBusinessMetrics, businessToSamples } from "./business"
import { checkAll, type HealthResult } from "./health"
import { readHeartbeat, touchHeartbeat } from "./heartbeat"
import { evaluateMetricAlerts, evaluateHealthAlerts, seedDefaultAlertRules } from "./alerts"
import { readEmailBounceRate } from "@/lib/email/analytics"
import { emitOps } from "@/lib/core/events"
import { cache } from "@/lib/redis"

/**
 * One full monitoring cycle: collect real metrics (system + app + business),
 * probe health, persist samples, evaluate alerts and push realtime updates.
 * Called by the monitor cron and reused anywhere a fresh snapshot is needed.
 */
export async function runCollection(): Promise<{
  samples: number
  health: HealthResult[]
  alerts: { fired: number; resolved: number }
}> {
  // Lazily ensure default alert rules exist (idempotent, throttled internally).
  await seedDefaultAlertRules().catch(() => {})

  const samples: MetricInput[] = []
  const add = (name: string, value: number | null | undefined) => {
    if (value != null && Number.isFinite(value)) samples.push({ name, value })
  }

  // 1) Infrastructure (real OS metrics; nulls are skipped, never faked).
  const sys = await getSystemSnapshot()
  add("system.cpu.usage", sys.cpu.usagePct)
  add("system.cpu.load1", sys.cpu.load1)
  add("system.mem.usage", sys.mem.usagePct)
  add("system.mem.used", sys.mem.usedBytes)
  add("system.disk.usage", sys.disk.usagePct)
  add("system.disk.io.read", sys.disk.readBps)
  add("system.disk.io.write", sys.disk.writeBps)
  add("system.net.rx", sys.net.rxBps)
  add("system.net.tx", sys.net.txBps)
  add("system.net.latency", sys.net.latencyMs)
  add("system.fd.open", sys.fdOpen)
  add("system.proc.count", sys.procCount)
  add("system.uptime", sys.uptimeSec)

  // 2) Application (request window + cache).
  const reqWindow = await readRequestWindow()
  if (reqWindow.requests > 0) {
    add("app.rps", reqWindow.rps)
    add("app.error_rate", reqWindow.errorRate)
  }
  // Real latency percentiles from the sampled reservoir (independent of the
  // request counter so p50/p95 are emitted whenever any latency was sampled).
  const lat = await readLatencyPercentiles()
  if (lat.count > 0) {
    add("app.latency.p50", lat.p50)
    add("app.latency.p95", lat.p95)
  }
  add("cache.hit_ratio", await readCacheHitRatio())

  // Genuine online presence (distinct authenticated users / sessions).
  const presence = await readPresence()
  add("app.active_users", presence.users)
  add("app.active_sessions", presence.sessions)

  // 3) Health probes (also yields DB/Redis internals).
  const health = await checkAll()
  const pg = health.find((h) => h.service === "postgres")
  if (pg) {
    add("db.latency", pg.latencyMs)
    const meta = (pg.meta ?? {}) as { connections?: number | null; slowQueries?: number | null }
    add("db.pool.used", meta.connections ?? null)
    add("db.slow_queries", meta.slowQueries ?? null)
  }
  const redis = health.find((h) => h.service === "redis")
  if (redis) add("redis.latency", redis.latencyMs)

  // Email queue health derived from the email probe's meta (no extra queries).
  const email = health.find((h) => h.service === "email")
  if (email) {
    const meta = (email.meta ?? {}) as { queued?: number; failed24h?: number }
    add("email.queue.size", meta.queued ?? null)
    add("email.failed", meta.failed24h ?? null)
    add("email.bounce_rate", await readEmailBounceRate())
  }

  // Worker-reported metrics (only present when those processes report in).
  const queueHb = await readHeartbeat("queue")
  if (queueHb?.meta && typeof queueHb.meta.size === "number") add("app.queue.size", queueHb.meta.size as number)
  if (queueHb?.meta && typeof queueHb.meta.latencyMs === "number") add("app.queue.latency", queueHb.meta.latencyMs as number)
  const wsHb = await readHeartbeat("ws")
  if (wsHb?.meta && typeof wsHb.meta.connections === "number") add("app.ws.connections", wsHb.meta.connections as number)
  const cronHb = await readHeartbeat("cron")
  if (cronHb?.meta && typeof cronHb.meta.durationMs === "number") add("app.cron.duration", cronHb.meta.durationMs as number)
  if (cronHb?.meta && typeof cronHb.meta.failures === "number") add("app.cron.failures", cronHb.meta.failures as number)

  // 4) Business metrics.
  const business = await getBusinessMetrics()
  for (const s of businessToSamples(business)) add(s.name, s.value)

  // Persist everything in one batch.
  await recordMany(samples)

  // 5) Evaluate alerts against the freshly collected values.
  const latest: Record<string, number> = {}
  for (const s of samples) latest[s.name] = s.value
  const metricAlerts = await evaluateMetricAlerts(latest)
  const healthAlerts = await evaluateHealthAlerts(health)

  // 6) Push realtime updates to the dashboard.
  await emitOps({ kind: "metrics", payload: { ...latest } })
  await emitOps({
    kind: "health",
    payload: { services: health.map((h) => ({ service: h.service, status: h.status, latencyMs: h.latencyMs })) },
  })

  // 7) Occasional retention prune (~1 in 30 cycles).
  if (Math.random() < 1 / 30) await pruneOldMetrics(7)

  return {
    samples: samples.length,
    health,
    alerts: { fired: metricAlerts.fired + healthAlerts.fired, resolved: metricAlerts.resolved + healthAlerts.resolved },
  }
}

// ---------------------------------------------------------------------------
// On-demand collection (keeps the dashboard populated without relying on a
// fast external scheduler).
// ---------------------------------------------------------------------------

/** Minimum gap between on-demand collections triggered by dashboard reads. */
const FRESH_INTERVAL_MS = 15_000

// In-process guards: coalesce the parallel requests fired by a single dashboard
// load into ONE collection, and throttle subsequent polls per instance.
let lastRunAt = 0
let inFlight: Promise<void> | null = null

/**
 * Ensure recent monitoring data exists, collecting on demand when it's stale.
 *
 * This is what makes `/admin/ops` show real, current data the moment it is
 * opened — even on serverless where a per-minute cron may not be running, and
 * on a fresh database with no samples yet. It is safe to call from every read
 * endpoint: concurrent callers share a single in-flight run, and runs are
 * throttled to at most once per `FRESH_INTERVAL_MS` per instance (plus a
 * best-effort cross-instance lock when Redis is available).
 *
 * Errors never propagate — monitoring reads must succeed even if a probe fails.
 */
export async function ensureFreshCollection(): Promise<void> {
  if (inFlight) return inFlight
  if (Date.now() - lastRunAt < FRESH_INTERVAL_MS) return

  // Best-effort cross-instance throttle. With Redis this prevents several
  // serverless isolates from collecting at once; in memory mode it's a no-op
  // guard local to this instance (harmless duplicate work at worst).
  const gotLock = await cache
    .setIfAbsent("ops:collect:lock", String(Date.now()), 12)
    .catch(() => true)
  if (!gotLock) {
    lastRunAt = Date.now()
    return
  }

  inFlight = (async () => {
    const startedAt = Date.now()
    let failed = 0
    try {
      await runCollection()
    } catch (e) {
      failed = 1
      console.log("[v0] ensureFreshCollection error:", (e as Error).message)
    } finally {
      // Record a cron heartbeat so the "cron" service reports live while the
      // dashboard is driving collection (mirrors what the scheduled cron does),
      // keeping the overall platform status accurate instead of UNKNOWN.
      void touchHeartbeat("cron", { durationMs: Date.now() - startedAt, failures: failed })
      lastRunAt = Date.now()
      inFlight = null
    }
  })()
  return inFlight
}

import "server-only"
import { getSystemSnapshot } from "./system"
import {
  recordMany,
  readRequestWindow,
  readCacheHitRatio,
  pruneOldMetrics,
  type MetricInput,
} from "./metrics"
import { getBusinessMetrics, businessToSamples } from "./business"
import { checkAll, type HealthResult } from "./health"
import { readHeartbeat } from "./heartbeat"
import { evaluateMetricAlerts, evaluateHealthAlerts } from "./alerts"
import { emitOps } from "@/lib/core/events"

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
    add("app.latency.p50", reqWindow.avgLatencyMs)
  }
  add("cache.hit_ratio", await readCacheHitRatio())

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

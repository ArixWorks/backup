import { prisma } from "@/lib/db"
import { getLatestHealth, overallStatus, type HealthResult } from "./health"
import { getLatestMany, readRequestWindow, readCacheHitRatio, getSeries } from "./metrics"
import { METRICS, metricSeverity, type MetricCategory } from "./registry"
import { getBusinessMetrics } from "./business"

/** A KPI snapshot value with its computed severity for coloring. */
export type Kpi = {
  name: string
  value: number | null
  unit?: string
  severity: "ok" | "warn" | "critical"
}

/** Health + request window + overall score for the dashboard header. */
export async function getOverview() {
  const [health, reqWindow, cacheHit, business] = await Promise.all([
    getLatestHealth(),
    readRequestWindow(),
    readCacheHitRatio(),
    getBusinessMetrics(),
  ])

  const overall = overallStatus(health)
  const up = health.filter((h) => h.status === "UP").length
  const total = health.length

  // A simple 0-100 performance scorecard derived from real signals.
  const errorRate = reqWindow.requests > 0 ? reqWindow.errors / reqWindow.requests : 0
  const latencyPenalty = Math.min(40, (reqWindow.avgLatencyMs ?? 0) / 25)
  const errorPenalty = Math.min(40, errorRate * 400)
  const healthPenalty = total > 0 ? (1 - up / total) * 20 : 0
  const score = Math.max(0, Math.round(100 - latencyPenalty - errorPenalty - healthPenalty))

  const openAlerts = await prisma.alertEvent.count({ where: { status: "FIRING" } })
  const unresolvedErrors = await prisma.errorEvent.count({ where: { resolved: false } })

  return {
    overall,
    servicesUp: up,
    servicesTotal: total,
    score,
    requests: reqWindow.requests,
    errors: reqWindow.errors,
    errorRate,
    avgLatencyMs: reqWindow.avgLatencyMs,
    rps: reqWindow.rps,
    cacheHitRatio: cacheHit,
    openAlerts,
    unresolvedErrors,
    business,
    health,
  }
}

/** Latest values for every metric in a category, with severity coloring. */
export async function getCategoryKpis(category: MetricCategory): Promise<Kpi[]> {
  const defs = METRICS.filter((m) => m.category === category)
  const latest = await getLatestMany(defs.map((d) => d.name))
  return defs.map((d) => {
    const value = latest[d.name] ?? null
    return {
      name: d.name,
      value,
      unit: d.unit,
      severity: value == null ? "ok" : metricSeverity(d.name, value),
    }
  })
}

/** Time-series for a set of metrics over a window (for charts). */
export async function getMetricSeries(names: string[], rangeMs: number, bucketMs: number) {
  const out: Record<string, { t: string; value: number }[]> = {}
  await Promise.all(
    names.map(async (name) => {
      out[name] = await getSeries(name, rangeMs, bucketMs)
    }),
  )
  return out
}

export type { HealthResult }

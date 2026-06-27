import "server-only"
import { prisma } from "@/lib/db"

/**
 * Statistical anomaly detection: compute a z-score for the latest value of a
 * metric against the rolling mean/stddev of its recent history. A high
 * |z-score| means the current reading deviates strongly from normal behavior.
 */

export interface AnomalyResult {
  metric: string
  value: number
  mean: number
  stddev: number
  zScore: number
  isAnomaly: boolean
  direction: "high" | "low" | "normal"
}

const DEFAULT_LOOKBACK_MS = 6 * 60 * 60_000 // 6h of history
const MIN_SAMPLES = 12
const Z_THRESHOLD = 3

export async function detectAnomaly(
  metric: string,
  opts: { lookbackMs?: number; zThreshold?: number } = {},
): Promise<AnomalyResult | null> {
  const lookbackMs = opts.lookbackMs ?? DEFAULT_LOOKBACK_MS
  const zThreshold = opts.zThreshold ?? Z_THRESHOLD
  const since = new Date(Date.now() - lookbackMs)

  const rows = await prisma.metricSample.findMany({
    where: { name: metric, capturedAt: { gte: since } },
    select: { value: true, capturedAt: true },
    orderBy: { capturedAt: "asc" },
  })
  if (rows.length < MIN_SAMPLES) return null

  const values = rows.map((r) => r.value)
  const latest = values[values.length - 1]
  // Baseline excludes the latest point so it isn't compared against itself.
  const baseline = values.slice(0, -1)
  const mean = baseline.reduce((a, b) => a + b, 0) / baseline.length
  const variance = baseline.reduce((a, b) => a + (b - mean) ** 2, 0) / baseline.length
  const stddev = Math.sqrt(variance)

  // If there's effectively no variance, only flag a non-trivial absolute jump.
  const zScore = stddev > 1e-9 ? (latest - mean) / stddev : 0
  const isAnomaly = Math.abs(zScore) >= zThreshold
  const direction: AnomalyResult["direction"] =
    !isAnomaly ? "normal" : zScore > 0 ? "high" : "low"

  return { metric, value: latest, mean, stddev, zScore, isAnomaly, direction }
}

/** Run anomaly detection across many metrics, returning only the anomalies. */
export async function detectAnomalies(metrics: string[]): Promise<AnomalyResult[]> {
  const results = await Promise.all(metrics.map((m) => detectAnomaly(m).catch(() => null)))
  return results.filter((r): r is AnomalyResult => r != null && r.isAnomaly)
}

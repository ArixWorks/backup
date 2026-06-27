import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getCategoryKpis, getMetricSeries } from "@/lib/monitoring/queries"
import type { MetricCategory } from "@/lib/monitoring/registry"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const RANGES: Record<string, { rangeMs: number; bucketMs: number }> = {
  "15m": { rangeMs: 15 * 60_000, bucketMs: 30_000 },
  "1h": { rangeMs: 60 * 60_000, bucketMs: 60_000 },
  "6h": { rangeMs: 6 * 60 * 60_000, bucketMs: 5 * 60_000 },
  "24h": { rangeMs: 24 * 60 * 60_000, bucketMs: 15 * 60_000 },
  "7d": { rangeMs: 7 * 24 * 60 * 60_000, bucketMs: 60 * 60_000 },
}

/**
 * GET /api/v1/admin/ops/metrics
 *   ?category=infra|app|business           -> latest KPIs for that category
 *   ?series=name1,name2&range=1h           -> bucketed time-series for charts
 */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const url = new URL(req.url)
  const series = url.searchParams.get("series")
  const rangeKey = url.searchParams.get("range") ?? "1h"
  const { rangeMs, bucketMs } = RANGES[rangeKey] ?? RANGES["1h"]

  if (series) {
    const names = series.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12)
    const data = await getMetricSeries(names, rangeMs, bucketMs)
    return { range: rangeKey, series: data }
  }

  const category = (url.searchParams.get("category") ?? "infra") as MetricCategory
  const kpis = await getCategoryKpis(category)
  return { category, kpis }
})

import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getBusinessMetrics } from "@/lib/monitoring/business"
import { getMetricSeries } from "@/lib/monitoring/queries"
import { ensureFreshCollection } from "@/lib/monitoring/collect"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const GET = route(async (req: Request) => {
  await requireAdmin()
  // Keep business time-series populated even when this tab is opened directly.
  await ensureFreshCollection()
  const rangeKey = new URL(req.url).searchParams.get("range") ?? "24h"
  const ranges: Record<string, number> = {
    "1h": 60 * 60_000,
    "6h": 6 * 60 * 60_000,
    "24h": 24 * 60 * 60_000,
    "7d": 7 * 24 * 60 * 60_000,
  }
  const rangeMs = ranges[rangeKey] ?? ranges["24h"]
  const bucketMs = rangeMs / 48

  const [current, series] = await Promise.all([
    getBusinessMetrics(),
    getMetricSeries(
      ["biz.orders_per_min", "biz.revenue_window", "biz.wallet_tx_per_min", "biz.active_users"],
      rangeMs,
      bucketMs,
    ),
  ])
  return { current, series, range: rangeKey }
})

import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getLatestHealth, checkAll, overallStatus } from "@/lib/monitoring/health"
import { ensureFreshCollection } from "@/lib/monitoring/collect"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/v1/admin/ops/health        -> last persisted snapshots (fast)
 * GET /api/v1/admin/ops/health?live=1 -> run live probes now (on-demand)
 */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const live = new URL(req.url).searchParams.get("live") === "1"
  if (live) {
    const services = await checkAll()
    return { overall: overallStatus(services), services }
  }
  // Default read: make sure a recent collection has run so the persisted
  // snapshots reflect real, current service status instead of UNKNOWN.
  await ensureFreshCollection()
  const services = await getLatestHealth()
  return { overall: overallStatus(services), services }
})

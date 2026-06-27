import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getLatestHealth, checkAll, overallStatus } from "@/lib/monitoring/health"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/v1/admin/ops/health        -> last persisted snapshots (fast)
 * GET /api/v1/admin/ops/health?live=1 -> run live probes now (on-demand)
 */
export const GET = route(async (req: Request) => {
  await requireAdmin()
  const live = new URL(req.url).searchParams.get("live") === "1"
  const services = live ? await checkAll() : await getLatestHealth()
  return { overall: overallStatus(services), services }
})

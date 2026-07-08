import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getOverview } from "@/lib/monitoring/queries"
import { ensureFreshCollection } from "@/lib/monitoring/collect"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export const GET = route(async () => {
  await requireAdmin()
  // Collect fresh real data on demand (throttled/coalesced) so the dashboard
  // is populated the moment it's opened, without depending on a fast cron.
  await ensureFreshCollection()
  return getOverview()
})

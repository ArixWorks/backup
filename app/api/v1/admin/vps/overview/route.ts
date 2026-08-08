import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getVpsOverview } from "@/lib/core/vps/stats"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return getVpsOverview()
})

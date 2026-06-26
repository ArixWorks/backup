import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getGrowthAnalytics } from "@/lib/core/growth"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return getGrowthAnalytics()
})

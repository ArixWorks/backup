import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { getReferralAdminOverview } from "@/lib/core/rewards"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return getReferralAdminOverview()
})

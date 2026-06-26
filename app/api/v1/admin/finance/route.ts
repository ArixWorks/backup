import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { financeOverview } from "@/lib/core/finance-admin"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return financeOverview()
})

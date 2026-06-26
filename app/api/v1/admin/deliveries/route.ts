import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { listPendingDeliveries } from "@/lib/core/admin"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  await requireAdmin()
  return listPendingDeliveries()
})

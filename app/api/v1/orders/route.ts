import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listShopOrdersForUser } from "@/lib/core/order-views"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  return listShopOrdersForUser(user.id)
})

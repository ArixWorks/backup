import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listWatchedProducts } from "@/lib/core/stock-alerts"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  return listWatchedProducts(user.id)
})

import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { getOrdersForUser } from "@/lib/core/catalog"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  return getOrdersForUser(user.id)
})

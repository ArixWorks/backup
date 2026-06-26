import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { unreadCount } from "@/lib/core/notifications"

export const dynamic = "force-dynamic"

export const GET = route(async () => {
  const user = await requireUser()
  const count = await unreadCount(user.id)
  return { count }
})

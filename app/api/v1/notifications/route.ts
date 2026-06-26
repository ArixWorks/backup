import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listNotifications, markAllRead } from "@/lib/core/notifications"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  const user = await requireUser()
  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get("unread") === "1"
  const limit = Number(url.searchParams.get("limit") ?? "30")
  return listNotifications(user.id, { unreadOnly, limit })
})

// Mark all as read.
export const POST = route(async () => {
  const user = await requireUser()
  return markAllRead(user.id)
})

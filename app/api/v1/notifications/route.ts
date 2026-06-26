import type { NotificationType } from "@prisma/client"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listNotifications, markAllRead } from "@/lib/core/notifications"

export const dynamic = "force-dynamic"

export const GET = route(async (req: Request) => {
  const user = await requireUser()
  const url = new URL(req.url)
  const unreadOnly = url.searchParams.get("unread") === "1"
  const archived = url.searchParams.get("archived") === "1"
  const limit = Number(url.searchParams.get("limit") ?? "30")
  const typeParam = url.searchParams.get("type")
  const search = url.searchParams.get("q")?.trim() || undefined
  return listNotifications(user.id, {
    unreadOnly,
    archived,
    limit,
    type: (typeParam as NotificationType) || undefined,
    search,
  })
})

// Mark all as read.
export const POST = route(async () => {
  const user = await requireUser()
  return markAllRead(user.id)
})

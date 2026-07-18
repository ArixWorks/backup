import { NotificationType } from "@prisma/client"
import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { listNotifications, markAllRead } from "@/lib/core/notifications"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  unread: z.enum(["0", "1"]).default("0"),
  archived: z.enum(["0", "1"]).default("0"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: z.nativeEnum(NotificationType).optional(),
  q: z.string().trim().max(200).optional(),
})

export const GET = route(async (req: Request) => {
  const user = await requireUser()
  const query = querySchema.parse(Object.fromEntries(new URL(req.url).searchParams))
  return listNotifications(user.id, {
    unreadOnly: query.unread === "1",
    archived: query.archived === "1",
    limit: query.limit,
    type: query.type,
    search: query.q || undefined,
  })
})

// Mark all as read.
export const POST = route(async () => {
  const user = await requireUser()
  return markAllRead(user.id)
})

import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { deleteNotification } from "@/lib/core/notifications"

export const dynamic = "force-dynamic"

// Permanently delete a single notification (owner-scoped).
export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  return deleteNotification(user.id, id)
})

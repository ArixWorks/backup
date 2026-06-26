import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { markRead } from "@/lib/core/notifications"

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  return markRead(user.id, id)
})

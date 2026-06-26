import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { archiveNotification, unarchiveNotification } from "@/lib/core/notifications"

export const dynamic = "force-dynamic"

// POST archives, DELETE unarchives (restores to inbox).
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  return archiveNotification(user.id, id)
})

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser()
  const { id } = await ctx.params
  return unarchiveNotification(user.id, id)
})

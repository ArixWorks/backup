import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { deleteInventoryItem } from "@/lib/core/admin"

export const DELETE = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  await deleteInventoryItem(id, admin.id)
  return { ok: true }
})

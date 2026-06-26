import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { cancelAuction } from "@/lib/core/admin-catalog"

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  await cancelAuction(id, admin.id)
  return { ok: true }
})

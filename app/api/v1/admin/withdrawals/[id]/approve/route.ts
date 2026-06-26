import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { approveWithdrawal } from "@/lib/core/finance"

export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  return approveWithdrawal(id, admin.id)
})

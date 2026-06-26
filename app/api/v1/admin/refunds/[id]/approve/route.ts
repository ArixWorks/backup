import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { approveRefund } from "@/lib/core/refunds"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export const POST = route(async (_req: Request, ctx: Ctx) => {
  const admin = await requireAdmin()
  const { id } = await ctx.params
  return approveRefund(id, admin.id)
})

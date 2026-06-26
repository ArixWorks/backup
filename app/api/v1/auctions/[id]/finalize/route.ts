import { route } from "@/lib/api/handler"
import { requireAdmin } from "@/lib/auth/session"
import { finalizeAuction } from "@/lib/core/auction"

export const POST = route(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    await requireAdmin()
    const { id } = await ctx.params
    return finalizeAuction(id)
  },
)

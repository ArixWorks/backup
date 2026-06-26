import { route } from "@/lib/api/handler"
import { getAuctionDetail } from "@/lib/core/catalog"

export const dynamic = "force-dynamic"

export const GET = route(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params
    return getAuctionDetail(id)
  },
)

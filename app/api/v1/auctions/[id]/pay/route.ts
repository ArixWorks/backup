import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { payAuctionBalance } from "@/lib/core/auction"
import { rateLimitBy } from "@/lib/api/rate-limit"

// Complete the outstanding balance for a PAYMENT_PENDING auction (deposit /
// partial-freeze mode). Only reachable when an opt-in freeze policy left the
// winner underfunded; the default full-freeze mode settles instantly at finalize.
export const POST = route(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser()
    const { id } = await ctx.params
    await rateLimitBy(user.id, { bucket: "auction:pay", limit: 20, windowSec: 60 })
    return payAuctionBalance({ auctionId: id, userId: user.id })
  },
)

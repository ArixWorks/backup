import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { buyNow } from "@/lib/core/auction"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { withIdempotency, idempotencyKey, readIdempotencyHeader } from "@/lib/api/idempotency"

export const POST = route(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser()
    const { id } = await ctx.params
    const header = readIdempotencyHeader(req)
    // Idempotent + throttled so a double-click can't buy the same item twice.
    await rateLimitBy(user.id, { bucket: "auction:buynow", limit: 30, windowSec: 60 })
    return withIdempotency(
      { key: idempotencyKey({ userId: user.id, operation: "auction:buynow", header, payload: { id } }) },
      () => buyNow({ userId: user.id, auctionId: id }),
    )
  },
)

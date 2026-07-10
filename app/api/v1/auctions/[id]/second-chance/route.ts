import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { acceptSecondChanceOffer, rejectSecondChanceOffer } from "@/lib/core/auction"
import { rateLimitBy } from "@/lib/api/rate-limit"

const schema = z.object({ action: z.enum(["ACCEPT", "REJECT"]) })

// Respond to a live Second Chance Offer. ACCEPT promotes the caller to winner
// and opens a fresh payment window; REJECT declines and advances the chain.
export const POST = route(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser()
    const { id } = await ctx.params
    const { action } = schema.parse(await req.json())
    await rateLimitBy(user.id, { bucket: "auction:second-chance", limit: 20, windowSec: 60 })
    return action === "ACCEPT"
      ? acceptSecondChanceOffer({ auctionId: id, userId: user.id })
      : rejectSecondChanceOffer({ auctionId: id, userId: user.id })
  },
)

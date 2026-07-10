import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { placeBid } from "@/lib/core/auction"
import { rateLimitBy, clientIp } from "@/lib/api/rate-limit"

const schema = z.object({
  amount: z.union([z.string(), z.number()]),
  maxAmount: z.union([z.string(), z.number()]).optional(),
  // Optional client-supplied device fingerprint for anti-fraud clustering.
  deviceId: z.string().trim().max(200).optional(),
})

export const POST = route(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser()
    const { id } = await ctx.params
    const body = schema.parse(await req.json())
    // Bids aren't idempotent (each is distinct) but we throttle per user to
    // stop rapid-fire bid spam from hammering the auction lock.
    await rateLimitBy(user.id, { bucket: "auction:bid", limit: 60, windowSec: 60 })
    return placeBid({
      userId: user.id,
      auctionId: id,
      amount: BigInt(body.amount),
      maxAmount:
        body.maxAmount != null && `${body.maxAmount}`.trim() !== ""
          ? BigInt(body.maxAmount)
          : undefined,
      context: {
        source: "web",
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent"),
        deviceId: body.deviceId ?? null,
      },
    })
  },
)

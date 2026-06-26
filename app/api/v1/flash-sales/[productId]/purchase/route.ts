import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { purchaseFixed } from "@/lib/core/flash-sale"
import { rateLimitBy } from "@/lib/api/rate-limit"
import { withIdempotency, idempotencyKey, readIdempotencyHeader } from "@/lib/api/idempotency"

const schema = z.object({
  quantity: z.number().int().min(1).max(50).default(1),
  reservationToken: z.string().optional(),
  couponCode: z.string().trim().max(40).optional(),
})

export const POST = route(
  async (req: Request, ctx: { params: Promise<{ productId: string }> }) => {
    const user = await requireUser()
    const { productId } = await ctx.params
    const header = readIdempotencyHeader(req)
    const body = schema.parse(await req.json().catch(() => ({})))
    // Throttle checkout, and make it idempotent so a double-tap on "buy" can't
    // place two paid orders / double-charge the wallet.
    await rateLimitBy(user.id, { bucket: "flash:purchase", limit: 30, windowSec: 60 })
    return withIdempotency(
      {
        key: idempotencyKey({
          userId: user.id,
          operation: "flash:purchase",
          header,
          payload: { productId, ...body },
        }),
      },
      () =>
        purchaseFixed({
          userId: user.id,
          productId,
          quantity: body.quantity,
          reservationToken: body.reservationToken,
          couponCode: body.couponCode,
        }),
    )
  },
)

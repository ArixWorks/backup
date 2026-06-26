import { z } from "zod"
import { route } from "@/lib/api/handler"
import { requireUser } from "@/lib/auth/session"
import { reserveFixedSale } from "@/lib/core/flash-sale"
import { rateLimitBy } from "@/lib/api/rate-limit"

const schema = z.object({ quantity: z.number().int().min(1).max(50).default(1) })

export const POST = route(
  async (req: Request, ctx: { params: Promise<{ productId: string }> }) => {
    const user = await requireUser()
    const { productId } = await ctx.params
    const body = schema.parse(await req.json().catch(() => ({})))
    // Stop reservation churn that would otherwise lock stock away from others.
    await rateLimitBy(user.id, { bucket: "flash:reserve", limit: 30, windowSec: 60 })
    return reserveFixedSale(user.id, productId, body.quantity)
  },
)
